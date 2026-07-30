"""Tool registry: the model-facing tool list + validated dispatch (ADR-0007).

Foundation 1's runtime. Built-ins come from builtin.py; domain packs under
tools/<pack>/ plug into the same registry later (Phase 2 proper). The registry
also renders tools/descriptions.md — the context-stack index (position 2) —
so the index can never drift from what is actually callable.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from opentracy.tools.builtin import Tool, ToolError, build_builtin_tools


class ToolRegistry:
    def __init__(self, tools: list[Tool]):
        self._tools = {tool.name: tool for tool in tools}

    @classmethod
    def with_builtins(cls, root: Path | str) -> "ToolRegistry":
        return cls(build_builtin_tools(root))

    @property
    def names(self) -> list[str]:
        return list(self._tools)

    def to_api(self) -> list[dict[str, Any]]:
        """Anthropic Messages API `tools` parameter."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in self._tools.values()
        ]

    def execute(self, name: str, tool_input: dict[str, Any]) -> tuple[str, bool]:
        """Run a tool; returns (output, is_error). Never raises — errors go
        back to the model so it can adapt."""
        tool = self._tools.get(name)
        if tool is None:
            return f"unknown tool: {name}", True
        try:
            return tool.handler(**tool_input), False
        except ToolError as exc:
            return str(exc), True
        except TypeError as exc:
            return f"invalid arguments for {name}: {exc}", True
        except Exception as exc:  # noqa: BLE001 — the loop must survive any tool
            return f"{type(exc).__name__}: {exc}", True

    def render_index(self) -> str:
        """tools/descriptions.md content — regenerated so it never drifts."""
        import re

        def first_sentence(text: str) -> str:
            # split on ". " only when followed by a capital (so "e.g." survives)
            return re.split(r"\.\s+(?=[A-Z])", text)[0].rstrip(".") + "."

        rows = "\n".join(
            f"| {tool.name} | builtin | {first_sentence(tool.description)} |"
            for tool in self._tools.values()
        )
        return (
            "---\n"
            "managed: runtime      # regenerated from the ToolRegistry — do not hand-edit\n"
            "position: 2\n"
            "budget_tokens: 4000\n"
            "generator: src/opentracy/tools/registry.py\n"
            "---\n\n"
            "# Tools index\n\n"
            "Every available tool: what it does and when to reach for it. The\n"
            "machine-readable schemas are passed to the API separately; this index\n"
            "is guidance.\n\n"
            "| Tool | Pack | Use when |\n"
            "|---|---|---|\n"
            f"{rows}\n"
        )

    def sync_index(self, root: Path | str) -> None:
        path = Path(root) / "tools" / "descriptions.md"
        if not path.parent.exists():
            return
        content = self.render_index()
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
