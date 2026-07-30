---
managed: runtime      # regenerated from the ToolRegistry — do not hand-edit
position: 2
budget_tokens: 4000
generator: src/opentracy/tools/registry.py
---

# Tools index

Every available tool: what it does and when to reach for it. The
machine-readable schemas are passed to the API separately; this index
is guidance.

| Tool | Pack | Use when |
|---|---|---|
| read | builtin | Read a file from the workspace, with line numbers. |
| bash | builtin | Run a shell command in the workspace root. |
| edit | builtin | Replace an exact string in a file. old_string must match exactly once (or set replace_all). |
| write | builtin | Create or overwrite a file (parent dirs created). |
| grep | builtin | Regex search across workspace files; returns file:line: text. |
| find | builtin | Find files by name/glob pattern (e.g. '*.md', 'SKILL.md'). |
| ls | builtin | List a directory's entries. |
