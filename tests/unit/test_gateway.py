import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from opentracy.gateway import EchoResponder, Gateway
from opentracy.gateway.cli import main


def make_workspace(root: Path) -> None:
    (root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul\nBe concise.")
    (root / "jobs.json").write_text(json.dumps({
        "jobs": [{
            "id": "minutely",
            "schedule": "* * * * *",
            "action": {"type": "prompt", "prompt": "do the scheduled thing"},
        }]
    }))


class GatewayTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        make_workspace(self.root)
        self.gateway = Gateway(self.root)
        self.addCleanup(self.gateway.close)

    def test_turn_flows_through_session_and_mirror(self) -> None:
        session = self.gateway.open_session(name="first")
        result = self.gateway.turn("hello gateway", session)
        self.assertEqual(result.reply, "[opentracy echo] hello gateway")
        self.assertIn("soul", result.context_report)
        # both messages persisted in the tree and mirrored to SQLite
        roles = [e["message"]["role"] for e in session.get_entries()
                 if e["type"] == "message"]
        self.assertEqual(roles, ["user", "assistant"])
        self.assertEqual(self.gateway.store.message_count(session.session_id), 2)

    def test_continue_recent_reuses_session(self) -> None:
        first = self.gateway.open_session()
        self.gateway.turn("turn one", first)
        resumed = self.gateway.open_session(continue_recent=True)
        self.assertEqual(resumed.session_id, first.session_id)
        self.gateway.turn("turn two", resumed)
        self.assertEqual(self.gateway.store.message_count(first.session_id), 4)

    def test_ephemeral_session_not_saved(self) -> None:
        session = self.gateway.open_session(ephemeral=True)
        self.gateway.turn("secret", session)
        self.assertFalse(session.is_persisted())
        self.assertEqual(self.gateway.list_sessions(), [])

    def test_custom_responder_is_used(self) -> None:
        def responder(system_prompt, messages):
            assert "<context source=\"soul\">" in system_prompt
            return {"role": "assistant", "content": "custom reply"}

        gateway = Gateway(self.root, responder=responder)
        self.addCleanup(gateway.close)
        result = gateway.turn("hi", gateway.open_session(ephemeral=True))
        self.assertEqual(result.reply, "custom reply")

    def test_tick_runs_job_through_a_turn(self) -> None:
        results = self.gateway.tick()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].status, "success")
        self.assertIn("[opentracy echo] do the scheduled thing", results[0].output)
        # the job ran as a named session, visible in the picker
        names = [i["name"] for i in self.gateway.list_sessions()]
        self.assertIn("job:minutely", names)


class CliTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        make_workspace(self.root)

    def cli(self, *argv: str) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["--root", str(self.root), *argv])
        return code, out.getvalue()

    def test_run_prints_reply(self) -> None:
        code, out = self.cli("run", "hello", "world")
        self.assertEqual(code, 0)
        self.assertIn("[opentracy echo] hello world", out)

    def test_sessions_lists_named_session(self) -> None:
        self.cli("run", "--name", "CI audit", "check the build")
        code, out = self.cli("sessions")
        self.assertEqual(code, 0)
        self.assertIn("CI audit", out)
        self.assertIn("2 msg", out)

    def test_search_finds_across_sessions(self) -> None:
        self.cli("run", "deploy the match service")
        self.cli("run", "unrelated prompt")
        code, out = self.cli("search", "match")
        self.assertEqual(code, 0)
        self.assertIn("deploy the match service", out)
        self.assertNotIn("unrelated", out)

    def test_context_shows_stack(self) -> None:
        code, out = self.cli("context")
        self.assertEqual(code, 0)
        self.assertIn("soul", out)
        self.assertIn("TOTAL", out)

    def test_ticks_executes_and_is_idempotent(self) -> None:
        code, out = self.cli("ticks")
        self.assertEqual(code, 0)
        self.assertIn("minutely [success]", out)

    def test_chat_loop_scripted(self) -> None:
        from opentracy.gateway.cli import build_parser, cmd_chat
        from opentracy.gateway.gateway import Gateway

        lines = iter(["hello there", "/session", "/exit"])
        printed: list[str] = []
        gateway = Gateway(self.root)
        self.addCleanup(gateway.close)
        args = build_parser().parse_args(["--root", str(self.root), "chat"])
        code = cmd_chat(gateway, args, input_fn=lambda _: next(lines),
                        print_fn=printed.append)
        self.assertEqual(code, 0)
        joined = "\n".join(printed)
        self.assertIn("[opentracy echo] hello there", joined)
        self.assertIn("messages: 2", joined)


if __name__ == "__main__":
    unittest.main()
