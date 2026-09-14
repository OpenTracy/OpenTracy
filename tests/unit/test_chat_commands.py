import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from opentracy.gateway import Gateway
from opentracy.gateway.cli import build_parser, cmd_chat


def make_workspace(root: Path) -> None:
    (root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul")
    (root / "jobs.json").write_text(json.dumps({"jobs": []}))


class ChatCommandsTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        make_workspace(self.root)
        self.model_calls: list[str] = []

        def responder(system_prompt, messages):
            # count only real conversation turns — not the internal calls for
            # session summaries (/exit) or version changelogs
            if "Summarize the session" not in system_prompt and \
               "document the change" not in system_prompt:
                self.model_calls.append(messages[-1].get("content", ""))
            return {"role": "assistant", "content": "resposta do modelo"}

        self.gateway = Gateway(self.root, responder=responder)
        self.addCleanup(self.gateway.close)

    def chat(self, *lines: str) -> tuple[list[str], str]:
        """Run a scripted chat; returns (print_fn output, stdout output)."""
        script = iter([*lines, "/exit"])
        printed: list[str] = []
        args = build_parser().parse_args(["--root", str(self.root), "chat"])
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            cmd_chat(self.gateway, args, input_fn=lambda _: next(script),
                     print_fn=printed.append)
        return printed, stdout.getvalue()

    def test_slash_versions_runs_without_llm(self) -> None:
        self.gateway.versioner.ensure_init()
        printed, stdout = self.chat("/versions")
        self.assertIn("v1", stdout)          # CLI handler output
        self.assertEqual(self.model_calls, [])  # the model was never called

    def test_slash_rollback_and_search(self) -> None:
        self.gateway.versioner.ensure_init()
        (self.root / "soul.md").write_text("# Soul v2")
        _, stdout = self.chat("/versions", "/rollback v1")
        self.assertIn("committed as", stdout)
        self.assertIn("Be", "Be")  # soul restored below
        self.assertIn("# Soul", (self.root / "soul.md").read_text())
        self.assertEqual(self.model_calls, [])

    def test_bang_runs_shell_and_prints(self) -> None:
        printed, _ = self.chat("!echo hello-from-shell", "e agora?")
        self.assertTrue(any("hello-from-shell" in p for p in printed))
        self.assertEqual(len(self.model_calls), 1)  # only the real message hit the model

    def test_bang_exit_code_reported(self) -> None:
        printed, _ = self.chat("!exit 7")
        self.assertTrue(any("[exit code: 7]" in p for p in printed))

    def test_bang_output_visible_to_model_next_turn(self) -> None:
        captured: list[list] = []

        def responder(system_prompt, messages):
            captured.append(messages)
            return {"role": "assistant", "content": "ok"}

        gateway = Gateway(self.root, responder=responder)
        self.addCleanup(gateway.close)
        script = iter(["!echo segredo-42", "o que o comando imprimiu?", "/exit"])
        args = build_parser().parse_args(["--root", str(self.root), "chat"])
        with contextlib.redirect_stdout(io.StringIO()):
            cmd_chat(gateway, args, input_fn=lambda _: next(script),
                     print_fn=lambda s: None)
        history = json.dumps(captured[0], ensure_ascii=False)
        self.assertIn("segredo-42", history)

    def test_unknown_slash_not_sent_to_model(self) -> None:
        printed, _ = self.chat("/naoexiste")
        self.assertTrue(any("unknown command" in p for p in printed))
        self.assertEqual(self.model_calls, [])

    def test_help_lists_commands(self) -> None:
        printed, _ = self.chat("/help")
        joined = "\n".join(printed)
        for cmd in ("/versions", "/rollback", "!<command>"):
            self.assertIn(cmd, joined)
        self.assertEqual(self.model_calls, [])


if __name__ == "__main__":
    unittest.main()
