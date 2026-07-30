---
name: manage-memory
description: How to save, update, and organize what you learn about the user and the work — user.md, memory.md, past_sessions archive
triggers: ["remember", "lembre", "memória", "preference", "save this"]
tools: [read, edit, write]
---

# manage-memory

You maintain three memory documents. Read the target file first, then edit —
never rewrite a file wholesale to add one fact.

## Where each fact goes

| Fact | File | Section |
|---|---|---|
| Who the user is (role, background, identity) | `memory/user.md` | Profile / Background / Extracted facts |
| How they work: preferences, workflows, platform habits | `memory/memory.md` | matching section |
| Behavioral instructions ("always answer in Portuguese") | `memory/memory.md` → Preferences & conventions | (soul.md is hand-edited only — never write it) |

## Write policies (from the files' frontmatter — they are binding)

1. **Dedupe before write** — grep/read the file first; if the fact exists, update
   that line instead of adding a duplicate.
2. **Update over duplicate** — a changed fact replaces the old line (use `edit`).
3. **Delete falsified facts** — if the user contradicts a stored fact, remove it.
4. **One bullet per fact**, concrete and short. Date extracted facts:
   `- <fact> · first observed YYYY-MM-DD`.
5. **Respect the budget** — memory.md has a 6000-token budget; if it is getting
   long, move cold facts to `memory/archive/` (one fact per file) and keep the
   hottest inline.

## When to save proactively

Save without being asked when the user states a durable preference, corrects
you, or reveals stable context (role, project, conventions). Do NOT save
one-off task details, secrets/credentials (never), or anything already written
in the repo.
