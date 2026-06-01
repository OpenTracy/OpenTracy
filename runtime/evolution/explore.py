"""Pre-experiment explore agent — cold-start workspace seeding.

Per AHE §3 (explore_agent), before the first evolve iteration runs
the orchestrator can spawn a one-shot exploration sandbox that reads
curated sources (source repos, blog posts, framework docs) and writes
its findings to ``.opentracy/skills/explore_findings.md``. The next
Evolve Agent picks that skill up as ambient knowledge — patterns that
would otherwise take many iterations of trial-and-error to discover.

Not auto-invoked by :func:`runtime.evolution.loop.run_one_iteration`
— this is a tool the runtime exposes so an operator (or the
``customer-support-agent-for-my-sh`` style onboarding flow) can seed
a fresh agent without waiting for the loop to learn from scratch.

Each source declares a ``focus`` so the agent reads with intent
rather than dumping irrelevant prose. Source types:
  - ``url``: a single web page to fetch via the sandbox's WebFetch
  - ``git``: a repo to clone and grep through (path globs in ``focus``
    are honored as hints, not hard filters)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional


logger = logging.getLogger("runtime.evolution.explore")


EXPLORE_OUTPUT_FILE = ".opentracy/skills/explore_findings.md"


@dataclass
class ExploreSource:
    type: str       # "url" | "git"
    url: str
    focus: str = ""

    def to_prompt_line(self) -> str:
        focus = f" — focus: {self.focus}" if self.focus else ""
        return f"- [{self.type}] {self.url}{focus}"


@dataclass
class ExploreOutcome:
    files_written: list[str] = field(default_factory=list)
    raw_response: str = ""
    sources_explored: int = 0
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "files_written": list(self.files_written),
            "raw_response": self.raw_response,
            "sources_explored": self.sources_explored,
            "error": self.error,
        }


def seed_workspace_via_explore(
    *,
    workspace: Any,
    anthropic_key: str,
    sources: list[ExploreSource],
    sandbox_factory: Optional[Any] = None,
    timeout_s: int = 600,
    model: Optional[str] = None,
) -> ExploreOutcome:
    """Run a one-shot exploration sandbox.

    The sandbox is given the same workspace tar as a regular evolve
    iteration plus a system prompt that channels everything into the
    explore_findings.md skill file. Findings are append-friendly so
    re-running explore later (with new sources) accretes rather than
    overwrites.

    Returns an :class:`ExploreOutcome` describing what landed in the
    workspace. ``sources_explored`` reflects the input count — the
    sandbox may have skipped sources internally, but verifying that
    would require parsing the agent's output.
    """
    if not sources:
        return ExploreOutcome(error="no sources provided")

    from runtime.sandbox import SandboxRun as _DefaultSandbox

    SandboxRun = sandbox_factory or _DefaultSandbox

    workspace.ensure()
    system_prompt = _build_explore_prompt(sources=sources)
    tar_in = workspace.to_tar_bytes()
    files_before = set(workspace.list_files(max_files=10_000))
    response_chunks: list[str] = []
    err: Optional[str] = None

    try:
        with SandboxRun(
            anthropic_key=anthropic_key,
            timeout_s=timeout_s,
        ) as sb:
            sb.upload_workspace_tar(tar_in)
            for evt in sb.run_claude(
                "Explore the sources and seed the workspace.",
                system=system_prompt,
                model=model,
            ):
                kind = evt.get("type")
                if kind == "stdout":
                    response_chunks.append(evt.get("data") or "")
                elif kind == "stderr":
                    logger.info("explore sandbox stderr: %s", evt.get("data"))
                elif kind == "error":
                    err = str(evt.get("detail") or "")
                    logger.warning("explore sandbox error: %s", err)
                    break
                elif kind == "done":
                    break
            try:
                tar_out = sb.snapshot_workspace_tar()
                workspace.from_tar_bytes(tar_out)
            except Exception as exc:
                logger.warning("explore: snapshot back failed: %s", exc)
                if err is None:
                    err = f"snapshot_back: {exc}"
    except Exception as exc:
        logger.warning("explore: sandbox boot failed: %s", exc, exc_info=True)
        err = f"sandbox_boot: {type(exc).__name__}: {exc}"

    files_after = set(workspace.list_files(max_files=10_000))
    files_written = sorted(files_after - files_before)
    return ExploreOutcome(
        files_written=files_written,
        raw_response="".join(response_chunks).strip(),
        sources_explored=len(sources),
        error=err,
    )


def _build_explore_prompt(*, sources: list[ExploreSource]) -> str:
    src_lines = [s.to_prompt_line() for s in sources]
    return (
        "You are the EXPLORE agent for a fresh Opentracy harness. No\n"
        "human is waiting on you. Your single job is to read the\n"
        "curated sources below and produce ONE skill file with\n"
        "actionable findings the next evolve iteration can use.\n\n"
        "Steps (do them in this order):\n"
        "  1. For each source, fetch or clone it. Use WebFetch for URLs,\n"
        "     `git clone` to /tmp for git sources.\n"
        "  2. Read with the source's `focus:` as your filter. Skip\n"
        "     anything that doesn't bear on the focus.\n"
        "  3. Synthesize patterns: domain conventions, recurring pitfalls,\n"
        "     proven strategies, environment quirks. Each pattern should\n"
        "     be a 1-3 sentence finding citing the source.\n"
        "  4. Write the findings to `.opentracy/skills/explore_findings.md`\n"
        "     with sections matching long_term.md's outline (domain\n"
        "     conventions / recurring pitfalls / proven strategies /\n"
        "     environment quirks). Each finding line ends with the\n"
        "     source URL in parentheses.\n\n"
        "Constraints:\n"
        "  - Do NOT modify any other file. The next evolve iteration\n"
        "    will decide what to promote into system_prompt / long_term.\n"
        "  - No invented patterns — every finding must trace to a source.\n"
        "  - If a source is unreachable, note it under a `## Skipped` "
        "section and continue.\n\n"
        "Sources:\n"
        f"{chr(10).join(src_lines)}\n\n"
        "Reply with one short paragraph summarizing what you wrote."
    )
