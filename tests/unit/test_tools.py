import tempfile
import unittest
from pathlib import Path

from opentracy.tools import ToolRegistry


class ToolsTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        (self.root / "memory").mkdir()
        (self.root / "memory" / "user.md").write_text("# User\n\n## Profile\n")
        self.registry = ToolRegistry.with_builtins(self.root)

    def run_tool(self, name, **kwargs):
        output, is_error = self.registry.execute(name, kwargs)
        return output, is_error

    def test_api_schema_shape(self) -> None:
        api = self.registry.to_api()
        self.assertEqual(
            {t["name"] for t in api},
            {"read", "bash", "edit", "write", "grep", "find", "ls"},
        )
        for tool in api:
            self.assertIn("input_schema", tool)
            self.assertFalse(tool["input_schema"]["additionalProperties"])

    def test_write_read_edit_round_trip(self) -> None:
        out, err = self.run_tool("write", path="memory/memory.md",
                                 content="# Memory\n- fact one\n")
        self.assertFalse(err)
        out, err = self.run_tool("read", path="memory/memory.md")
        self.assertFalse(err)
        self.assertIn("fact one", out)
        self.assertIn("1\t", out)  # line numbers
        out, err = self.run_tool("edit", path="memory/memory.md",
                                 old_string="fact one", new_string="fact two")
        self.assertFalse(err)
        self.assertIn("fact two", (self.root / "memory" / "memory.md").read_text())

    def test_edit_requires_unique_match(self) -> None:
        (self.root / "a.txt").write_text("x\nx\n")
        out, err = self.run_tool("edit", path="a.txt", old_string="x", new_string="y")
        self.assertTrue(err)
        self.assertIn("2 times", out)
        out, err = self.run_tool("edit", path="a.txt", old_string="x",
                                 new_string="y", replace_all=True)
        self.assertFalse(err)
        self.assertEqual((self.root / "a.txt").read_text(), "y\ny\n")

    def test_path_escape_is_blocked(self) -> None:
        for name, kwargs in [
            ("read", {"path": "../outside.txt"}),
            ("write", {"path": "/etc/hosts2", "content": "x"}),
            ("ls", {"path": "../../"}),
        ]:
            out, err = self.run_tool(name, **kwargs)
            self.assertTrue(err, f"{name} should reject escaping path")
            self.assertIn("escape", out)

    def test_bash_runs_in_workspace(self) -> None:
        out, err = self.run_tool("bash", command="pwd && echo ok")
        self.assertFalse(err)
        self.assertIn(str(self.root.resolve()), out)
        self.assertIn("ok", out)

    def test_bash_reports_exit_code(self) -> None:
        out, err = self.run_tool("bash", command="exit 3")
        self.assertFalse(err)  # non-zero exit is information, not a tool error
        self.assertIn("[exit code: 3]", out)

    def test_grep_and_find_and_ls(self) -> None:
        (self.root / "notes.md").write_text("todo: wire the harness\n")
        out, _ = self.run_tool("grep", pattern="wire the", path=".")
        self.assertIn("notes.md:1", out)
        out, _ = self.run_tool("find", pattern="*.md")
        self.assertIn("notes.md", out)
        self.assertIn("memory/user.md", out)
        out, _ = self.run_tool("ls", path="memory")
        self.assertIn("user.md", out)

    def test_unknown_tool_and_bad_args(self) -> None:
        out, err = self.registry.execute("teleport", {})
        self.assertTrue(err)
        out, err = self.registry.execute("read", {"nope": 1})
        self.assertTrue(err)
        self.assertIn("invalid arguments", out)

    def test_index_sync(self) -> None:
        (self.root / "tools").mkdir()
        self.registry.sync_index(self.root)
        index = (self.root / "tools" / "descriptions.md").read_text()
        for name in self.registry.names:
            self.assertIn(f"| {name} |", index)


if __name__ == "__main__":
    unittest.main()
