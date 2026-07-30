import tempfile
import unittest
from pathlib import Path

from opentracy.core.context import ContextLayer, MarkdownFileSource, strip_frontmatter


def write(root: Path, rel: str, body: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


class ContextLayerTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)
        write(self.root, "soul.md", "---\nmanaged: human\n---\n\n# Soul\nBe concise.")

    def test_frontmatter_is_stripped(self) -> None:
        self.assertEqual(strip_frontmatter("---\na: 1\n---\nbody"), "body")
        self.assertEqual(strip_frontmatter("no frontmatter"), "no frontmatter")

    def test_stack_order_and_optional_skipping(self) -> None:
        write(self.root, "memory/memory.md", "# Memory\n- fact one")
        write(self.root, "sessions/past_sessions.md", "# Past sessions\n## entry")
        # tools/skills/user.md absent or empty -> skipped, order preserved
        ctx = ContextLayer.from_workspace(self.root).assemble()
        self.assertEqual([b.source for b in ctx.blocks], ["soul", "memory", "past_sessions"])

    def test_empty_document_is_skipped(self) -> None:
        write(self.root, "memory/user.md", "---\nmanaged: runtime\n---\n\n   \n")
        ctx = ContextLayer.from_workspace(self.root).assemble()
        self.assertNotIn("user", [b.source for b in ctx.blocks])

    def test_missing_required_soul_raises(self) -> None:
        (self.root / "soul.md").unlink()
        with self.assertRaises(FileNotFoundError):
            ContextLayer.from_workspace(self.root).assemble()

    def test_truncation_respects_budget_and_flags(self) -> None:
        write(self.root, "memory/memory.md", "x" * 4_000)  # ~1000 tokens
        ctx = ContextLayer.from_workspace(
            self.root, budget_overrides={"memory": 100}
        ).assemble()
        block = next(b for b in ctx.blocks if b.source == "memory")
        self.assertTrue(block.truncated)
        self.assertLessEqual(block.tokens, 120)  # budget + truncation marker
        self.assertIn("truncated to 100 token budget", block.content)

    def test_keep_tail_truncation(self) -> None:
        src = MarkdownFileSource(
            name="t", path=self.root / "soul.md", budget_tokens=2, keep="tail"
        )
        block = src.load()
        assert block is not None
        self.assertTrue(block.truncated)
        # tail-keep survives the END of the document (budget 2 tokens = last 8 chars)
        self.assertTrue(block.content.startswith("concise."))

    def test_system_prompt_renders_tagged_blocks(self) -> None:
        ctx = ContextLayer.from_workspace(self.root).assemble()
        self.assertIn('<context source="soul">', ctx.system_prompt)
        self.assertIn("Be concise.", ctx.system_prompt)
        self.assertNotIn("managed: human", ctx.system_prompt)  # frontmatter never spends tokens

    def test_report_accounts_every_block(self) -> None:
        ctx = ContextLayer.from_workspace(self.root).assemble()
        self.assertEqual(set(ctx.report()), {b.source for b in ctx.blocks})
        self.assertGreater(ctx.total_tokens, 0)


if __name__ == "__main__":
    unittest.main()
