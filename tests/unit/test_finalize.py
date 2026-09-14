import tempfile
import unittest
from pathlib import Path

from opentracy.gateway import Gateway

PAST_SESSIONS_TEMPLATE = """---
managed: runtime
position: 6
---

# Past sessions

One entry per completed session, newest first.

<!-- Entry template:

## YYYY-MM-DD · <session-id> — <one-line outcome>
- **Goal:** what the user asked for
-->
"""


def summarizing_responder(system_prompt, messages):
    if "Summarize the session" in system_prompt:
        return {
            "role": "assistant",
            "content": (
                "validated the harness end to end\n"
                "- **Goal:** test the chat\n"
                "- **Outcome:** it worked\n"
                "- **Decisions:** none\n"
                "- **Open threads:** wire tool use"
            ),
        }
    return {"role": "assistant", "content": "a reply"}


class FinalizeSessionTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        (self.root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul")
        (self.root / "sessions").mkdir()
        (self.root / "sessions" / "past_sessions.md").write_text(PAST_SESSIONS_TEMPLATE)
        self.gateway = Gateway(self.root, responder=summarizing_responder)
        self.addCleanup(self.gateway.close)

    def past_sessions(self) -> str:
        return (self.root / "sessions" / "past_sessions.md").read_text()

    def test_finalize_records_summary_everywhere(self) -> None:
        session = self.gateway.open_session()
        self.gateway.turn("test the chat", session)
        summary = self.gateway.finalize_session(session)

        self.assertIn("validated the harness", summary)
        # SQLite: ended_at + summary set
        info = next(s for s in self.gateway.store.list_sessions()
                    if s["id"] == session.session_id)
        self.assertIsNotNone(info["ended_at"])
        self.assertIn("validated the harness", info["summary"])
        # past_sessions.md: entry with heading, after the template comment
        content = self.past_sessions()
        sid = session.session_id[:8]
        self.assertIn(f"· {sid} — validated the harness end to end", content)
        self.assertIn("- **Open threads:** wire tool use", content)
        self.assertLess(content.find("-->"), content.find(f"· {sid}"))

    def test_newest_entry_comes_first(self) -> None:
        first = self.gateway.open_session()
        self.gateway.turn("first session", first)
        self.gateway.finalize_session(first)
        second = self.gateway.open_session()
        self.gateway.turn("second session", second)
        self.gateway.finalize_session(second)

        content = self.past_sessions()
        self.assertLess(
            content.find(f"· {second.session_id[:8]}"),
            content.find(f"· {first.session_id[:8]}"),
        )

    def test_refinalize_updates_instead_of_duplicating(self) -> None:
        session = self.gateway.open_session()
        self.gateway.turn("oi", session)
        self.gateway.finalize_session(session)
        self.gateway.turn("mais uma", session)  # continued after finalize
        self.gateway.finalize_session(session)

        sid = session.session_id[:8]
        self.assertEqual(self.past_sessions().count(f"· {sid} —"), 1)

    def test_empty_and_ephemeral_sessions_skip(self) -> None:
        empty = self.gateway.open_session()
        self.assertIsNone(self.gateway.finalize_session(empty))
        ephemeral = self.gateway.open_session(ephemeral=True)
        self.gateway.turn("oi", ephemeral)
        self.assertIsNone(self.gateway.finalize_session(ephemeral))
        self.assertNotIn("## 2", self.past_sessions())  # no entries written

    def test_echo_responder_uses_deterministic_fallback(self) -> None:
        gateway = Gateway(self.root)  # default EchoResponder
        self.addCleanup(gateway.close)
        session = gateway.open_session()
        gateway.turn("pergunta importante", session)
        summary = gateway.finalize_session(session)
        self.assertIn("no model summary available", summary)
        self.assertNotIn("[opentracy echo]", self.past_sessions())

    def test_chat_exit_triggers_finalization(self) -> None:
        from opentracy.gateway.cli import build_parser, cmd_chat

        lines = iter(["hello there", "/exit"])
        printed: list[str] = []
        args = build_parser().parse_args(["--root", str(self.root), "chat"])
        cmd_chat(self.gateway, args, input_fn=lambda _: next(lines),
                 print_fn=printed.append)
        self.assertTrue(any("summarized" in p for p in printed))
        self.assertIn("validated the harness", self.past_sessions())

    def test_next_session_sees_previous_summary_in_context(self) -> None:
        session = self.gateway.open_session()
        self.gateway.turn("test the chat", session)
        self.gateway.finalize_session(session)

        assembled = self.gateway.context.assemble()
        self.assertIn("validated the harness", assembled.system_prompt)


if __name__ == "__main__":
    unittest.main()
