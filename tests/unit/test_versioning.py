import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from opentracy.core.versioning import AgentVersioner
from opentracy.gateway import Gateway


def make_workspace(root: Path) -> None:
    (root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul\nBe concise.")
    (root / "agent.json").write_text(json.dumps({"model": "claude-opus-4-8"}))
    (root / "jobs.json").write_text(json.dumps({"jobs": []}))
    (root / "skills" / "core").mkdir(parents=True)
    (root / "skills" / "core" / "SKILL.md").write_text("# a skill")


class AgentVersionerTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        make_workspace(self.root)
        self.versioner = AgentVersioner(self.root)
        self.versioner.ensure_init()

    def test_baseline_v1_created(self) -> None:
        versions = self.versioner.list_versions()
        self.assertEqual([v.tag for v in versions], ["v1"])
        self.assertIn("baseline", versions[0].subject)
        self.assertFalse(self.versioner.is_dirty())

    def test_change_detected_and_versioned_with_changelog(self) -> None:
        (self.root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul\nBe bold.")
        self.assertTrue(self.versioner.is_dirty())
        self.assertIn("Be bold", self.versioner.pending_diff())

        v2 = self.versioner.commit_version(
            oneliner="tornou o tom mais ousado",
            body="- **What:** soul.md tone\n- **Why:** user asked\n"
                 "- **Expected impact:** more direct replies",
            trigger="session abc123",
        )
        self.assertEqual(v2.tag, "v2")
        self.assertFalse(self.versioner.is_dirty())
        shown = self.versioner.show("v2")
        self.assertIn("**Why:** user asked", shown)
        self.assertIn("Trigger: session abc123", shown)

    def test_untracked_new_skill_is_detected(self) -> None:
        (self.root / "skills" / "core" / "nova" ).mkdir()
        (self.root / "skills" / "core" / "nova" / "SKILL.md").write_text("# nova")
        self.assertTrue(self.versioner.is_dirty())
        self.assertIn("new file", self.versioner.pending_diff())

    def test_diff_between_versions(self) -> None:
        (self.root / "agent.json").write_text(json.dumps({"model": "claude-sonnet-5"}))
        self.versioner.commit_version("trocou modelo", "- **What:** model", "manual")
        diff = self.versioner.diff("v1", "v2")
        self.assertIn("claude-sonnet-5", diff)
        self.assertIn("claude-opus-4-8", diff)

    def test_rollback_restores_and_creates_new_version(self) -> None:
        (self.root / "soul.md").write_text("# Soul v2")
        new_skill = self.root / "skills" / "core" / "later" / "SKILL.md"
        new_skill.parent.mkdir()
        new_skill.write_text("# added after v1")
        self.versioner.commit_version("v2 changes", "- **What:** x", "manual")

        v3 = self.versioner.rollback("v1")
        self.assertEqual(v3.tag, "v3")
        # content restored, later-added file removed
        self.assertIn("Be concise", (self.root / "soul.md").read_text())
        self.assertFalse(new_skill.exists())
        # history intact: v2 still there, v3 documents the rollback
        tags = [v.tag for v in self.versioner.list_versions()]
        self.assertEqual(tags, ["v1", "v2", "v3"])
        self.assertIn("rollback", self.versioner.show("v3"))

    def test_rollback_of_rollback(self) -> None:
        (self.root / "soul.md").write_text("# Soul v2")
        self.versioner.commit_version("v2", "- x", "manual")
        self.versioner.rollback("v1")          # v3 = state of v1
        v4 = self.versioner.rollback("v2")     # v4 = state of v2 again
        self.assertEqual(v4.tag, "v4")
        self.assertEqual((self.root / "soul.md").read_text(), "# Soul v2")


class GatewayVersioningTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        make_workspace(self.root)

    def test_agent_made_change_documented_by_model(self) -> None:
        def responder(system_prompt, messages):
            if "document the change" in system_prompt:
                return {"role": "assistant",
                        "content": "ajustou o soul para respostas em português\n"
                                   "- **What:** soul.md language rule\n"
                                   "- **Why:** user prefers Portuguese\n"
                                   "- **Expected impact:** replies default to pt-BR"}
            # simulate the agent editing config during the turn
            (self.root / "soul.md").write_text("# Soul\nResponda em português.")
            return {"role": "assistant", "content": "feito"}

        gateway = Gateway(self.root, responder=responder)
        self.addCleanup(gateway.close)
        session = gateway.open_session(ephemeral=True)
        gateway.turn("responda sempre em português", session)

        versions = gateway.versioner.list_versions()
        self.assertEqual(len(versions), 2)  # v1 baseline + v2 documented
        shown = gateway.versioner.show("v2")
        self.assertIn("**Why:** user prefers Portuguese", shown)
        self.assertIn("Trigger: session", shown)

    def test_manual_edit_committed_on_next_turn(self) -> None:
        gateway = Gateway(self.root)  # echo responder
        self.addCleanup(gateway.close)
        session = gateway.open_session(ephemeral=True)
        gateway.turn("oi", session)  # creates baseline v1

        (self.root / "jobs.json").write_text(json.dumps({"jobs": [
            {"id": "x", "schedule": "0 0 * * *"}]}))
        gateway.turn("oi de novo", session)

        versions = gateway.versioner.list_versions()
        self.assertEqual(len(versions), 2)
        self.assertIn("Trigger: manual", gateway.versioner.show("v2"))

    def test_cli_versions_and_rollback(self) -> None:
        from opentracy.gateway.cli import main

        def cli(*argv):
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = main(["--root", str(self.root), *argv])
            return code, out.getvalue()

        code, out = cli("versions")
        self.assertEqual(code, 0)
        self.assertIn("v1", out)

        (self.root / "soul.md").write_text("# Soul\nnew tone")
        cli("versions")                    # commits the manual change as v2
        code, out = cli("versions", "--diff", "v1", "v2")
        self.assertIn("new tone", out)

        code, out = cli("rollback", "v1")
        self.assertEqual(code, 0)
        self.assertIn("committed as v3", out)
        self.assertIn("Be concise", (self.root / "soul.md").read_text())


if __name__ == "__main__":
    unittest.main()
