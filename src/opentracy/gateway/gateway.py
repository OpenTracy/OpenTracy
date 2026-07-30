"""The gateway: the single wiring point between frontends and the runtime.

Every frontend (the `opentracy` CLI today; desktop/HTTP later) talks to the agent
through this class — nothing else instantiates the subsystems. One Gateway
per workspace wires together:

    ContextLayer        (ADR-0001)  what the model sees each turn
    ContextCompressor   (ADR-0002)  preflight + overflow checks
    TranscriptStore     (ADR-0003)  SQLite mirror of every message
    JobScheduler        (ADR-0004)  ticks() over jobs.json
    SessionManager      (ADR-0005)  JSONL session trees

The model itself sits behind the Responder protocol. EchoResponder is the
stub used until the provider adapter lands — the gateway's job is CLI
communication and orchestration, not intelligence.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Protocol

import json

from opentracy.core.compression import CompressionConfig, ContextCompressor, Decision
from opentracy.core.context import AssembledContext, ContextLayer
from opentracy.core.scheduler import Job, JobScheduler, RunResult
from opentracy.core.session import SessionManager
from opentracy.core.versioning import AgentVersioner
from opentracy.memory.transcript import TranscriptStore
from opentracy.tools import ToolRegistry

Message = dict[str, Any]


class Responder(Protocol):
    """What the gateway needs from a model: context + history in, reply out."""

    def __call__(self, system_prompt: str, messages: list[Message]) -> Message: ...


class EchoResponder:
    """Stub responder: proves the plumbing end-to-end without an LLM."""

    def __call__(self, system_prompt: str, messages: list[Message]) -> Message:
        last_user = next(
            (m for m in reversed(messages) if m.get("role") == "user"), None
        )
        text = last_user.get("content") if last_user else ""
        if not isinstance(text, str):
            text = str(text)
        return {
            "role": "assistant",
            "content": f"[opentracy echo] {text}",
        }


@dataclass(frozen=True)
class TurnResult:
    reply: str
    session_id: str
    session_path: Path | None
    context_report: dict[str, Any]
    compression: Decision


class Gateway:
    def __init__(
        self,
        root: Path | str,
        responder: Responder | None = None,
        compression: CompressionConfig | None = None,
    ):
        self.root = Path(root)
        self.tools = ToolRegistry.with_builtins(self.root)
        self.tools.sync_index(self.root)  # tools/descriptions.md never drifts
        self.versioner = AgentVersioner(self.root)
        self.responder: Responder = responder or self._default_responder()
        self.context = ContextLayer.from_workspace(self.root)
        self.compressor = ContextCompressor(config=compression or CompressionConfig())
        self._store: TranscriptStore | None = None
        self.scheduler = JobScheduler(self.root, executor=self._execute_job)

    def _default_responder(self) -> Responder:
        """Claude with the tool registry when credentials exist; echo otherwise.
        Model settings come from agent.json — part of the versioned config plane."""
        try:
            from opentracy.providers.anthropic_responder import (
                AnthropicResponder,
                credentials_available,
            )

            if credentials_available():
                config = self.agent_config()
                return AnthropicResponder(
                    model=config.get("model", "claude-opus-4-8"),
                    max_tokens=config.get("max_tokens", 16_000),
                    max_steps=config.get("max_steps", 24),
                    tools=self.tools,
                )
        except ImportError:
            pass
        return EchoResponder()

    def agent_config(self) -> dict[str, Any]:
        path = self.root / "agent.json"
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    @property
    def store(self) -> TranscriptStore:
        if self._store is None:
            self._store = TranscriptStore(self.root / "sessions" / "transcripts.db")
        return self._store

    def close(self) -> None:
        if self._store is not None:
            self._store.close()
            self._store = None

    # ------------------------------------------------------------------
    # Sessions
    # ------------------------------------------------------------------

    def open_session(
        self,
        continue_recent: bool = False,
        session_path: Path | str | None = None,
        ephemeral: bool = False,
        name: str | None = None,
    ) -> SessionManager:
        if ephemeral:
            session = SessionManager.in_memory(str(self.root))
        elif session_path is not None:
            session = SessionManager.open(session_path, mirror=self.store)
        elif continue_recent:
            session = SessionManager.continue_recent(self.root, mirror=self.store)
        else:
            session = SessionManager.create(self.root, mirror=self.store)
        if name:
            session.append_session_info(name)
        return session

    def list_sessions(self) -> list[dict[str, Any]]:
        return SessionManager.list(self.root)

    def search(self, text: str, limit: int = 20) -> list[dict[str, Any]]:
        return self.store.search_messages(text, limit=limit)

    # ------------------------------------------------------------------
    # The turn — one user message through the full stack
    # ------------------------------------------------------------------

    def turn(self, text: str, session: SessionManager) -> TurnResult:
        # Versioning path 2 (manual edits): config changed outside a session
        # since the last version → commit with a deterministic changelog.
        # (first turn ever also creates the v1 baseline here)
        self.versioner.ensure_init()
        if self.versioner.is_dirty():
            self._commit_config_change(trigger="manual", session=None)

        session.append_message({"role": "user", "content": text})

        assembled: AssembledContext = self.context.assemble()
        messages = session.build_session_context()["messages"]

        # Compression moment 1: preflight. Applying the compaction to the
        # session tree needs the summarizer-backed loop (Phase 1 remainder);
        # until then the decision is surfaced, not acted on.
        decision = self.compressor.check_before_call(messages)

        reply_msg = self.responder(assembled.system_prompt, messages)

        # Compression moment "usage resp → add": real provider usage feeds
        # the compressor's token accounting (side-channel key, never persisted).
        usage = reply_msg.pop("_usage", None)
        if usage:
            self.compressor.update_from_response(usage, message_count=len(messages))

        # The agentic loop's intermediate turns (tool_use + tool_result) are
        # part of what happened — they go into the session tree and the SQLite
        # mirror like any other message.
        for intermediate in reply_msg.pop("_trace", None) or []:
            session.append_message(intermediate)

        session.append_message(reply_msg)

        # Versioning path 1 (agent-made changes): the model edited the config
        # plane during this turn → document with the model (it knows why) and
        # commit as a new version.
        if self.versioner.is_dirty():
            self._commit_config_change(trigger=f"session {session.session_id[:8]}",
                                       session=session)

        reply = reply_msg.get("content", "")
        if not isinstance(reply, str):
            reply = "".join(
                part.get("text", "") for part in reply if isinstance(part, dict)
            )
        return TurnResult(
            reply=reply,
            session_id=session.session_id,
            session_path=session.path,
            context_report=assembled.report(),
            compression=decision,
        )

    # ------------------------------------------------------------------
    # Config-change documentation (ADR-0007)
    # ------------------------------------------------------------------

    VERSION_DOC_PROMPT = (
        "The agent's configuration (soul/skills/jobs/model config) was just "
        "changed. Given the diff and the conversation context, document the "
        "change for the version history. Return EXACTLY this shape:\n"
        "line 1: one-line summary (max 12 words, no heading)\n"
        "- **What:** which files/settings changed, concretely\n"
        "- **Why:** the reason the change was made\n"
        "- **Expected impact:** what should get better (or riskier)"
    )

    def _commit_config_change(self, trigger: str, session: SessionManager | None):
        diff = self.versioner.pending_diff()
        if session is not None and not isinstance(self.responder, EchoResponder):
            context_msgs = [
                f"{m.get('role')}: {m.get('content')}"
                for e in session.get_entries() if e["type"] == "message"
                for m in [e["message"]]
                if isinstance(m.get("content"), str)
            ][-6:]
            prompt_input = (
                f"Diff of the change:\n{diff}\n\n"
                f"Conversation context:\n" + "\n".join(context_msgs)
            )
            try:
                reply = self.responder(
                    self.VERSION_DOC_PROMPT,
                    [{"role": "user", "content": prompt_input}],
                )
                reply.pop("_usage", None)
                reply.pop("_trace", None)
                lines = str(reply.get("content", "")).strip().splitlines()
                oneliner = lines[0].strip() if lines else "config change"
                body = "\n".join(lines[1:]).strip() or f"- **What:**\n```\n{diff}\n```"
                return self.versioner.commit_version(oneliner, body, trigger)
            except Exception:
                pass  # fall through to the deterministic changelog
        body = (
            "- **What:** config plane changed (diff below)\n"
            "- **Why:** edited outside a session (hand edit) or no model available\n"
            f"- **Expected impact:** unknown — review the diff\n\n```\n{diff}\n```"
        )
        return self.versioner.commit_version("config change (undocumented)", body, trigger)

    # ------------------------------------------------------------------
    # Session finalization — the write-back that feeds past_sessions.md
    # ------------------------------------------------------------------

    SUMMARY_PROMPT = (
        "Summarize the session below for a future session's context. "
        "Return EXACTLY this shape, nothing else:\n"
        "line 1: a one-line outcome (max 12 words, no heading)\n"
        "- **Goal:** what the user asked for\n"
        "- **Outcome:** what actually happened (faithful, including failures)\n"
        "- **Decisions:** choices future sessions must respect (or 'none')\n"
        "- **Open threads:** unfinished work (or 'none')"
    )

    def finalize_session(self, session: SessionManager) -> str | None:
        """Close out a session: summarize it, record ended_at + summary in
        SQLite, and prepend the entry to sessions/past_sessions.md (context
        stack position 6). Returns the summary, or None if there was nothing
        to finalize (ephemeral or empty session)."""
        messages = [
            e["message"] for e in session.get_entries() if e["type"] == "message"
        ]
        if not messages or not session.is_persisted():
            return None

        summary = self._summarize_session(messages)
        try:
            self.store.end_session(session.session_id, summary)
        except KeyError:
            pass  # session not mirrored (shouldn't happen for persisted ones)
        self._write_past_session_entry(session, summary)
        return summary

    def _summarize_session(self, messages: list[Message]) -> str:
        first_user = next(
            (m["content"] for m in messages if m.get("role") == "user" and
             isinstance(m.get("content"), str)),
            "(no user message)",
        )
        if isinstance(self.responder, EchoResponder):
            # No model available: deterministic fallback beats junk echoes.
            return (
                f"{first_user[:60]}\n"
                f"- **Goal:** {first_user[:120]}\n"
                f"- **Outcome:** {len(messages)} messages exchanged (no model summary available)\n"
                "- **Decisions:** none\n- **Open threads:** none"
            )
        transcript = "\n".join(
            f"{m.get('role', '?')}: {m.get('content', '')}" for m in messages
        )
        reply = self.responder(self.SUMMARY_PROMPT, [{"role": "user", "content": transcript}])
        reply.pop("_usage", None)
        content = reply.get("content", "")
        return content if isinstance(content, str) else str(content)

    def _write_past_session_entry(self, session: SessionManager, summary: str) -> None:
        path = self.root / "sessions" / "past_sessions.md"
        if not path.exists():
            return
        sid = session.session_id[:8]
        date = datetime.now().strftime("%Y-%m-%d")
        lines = summary.strip().splitlines()
        oneliner = lines[0].strip() if lines else "(no summary)"
        body = "\n".join(lines[1:]).strip()
        entry = f"## {date} · {sid} — {oneliner}\n{body}\n"

        content = path.read_text(encoding="utf-8")
        content = _remove_existing_entry(content, sid)
        # entries live after the template comment, newest first
        marker = "-->"
        pos = content.find(marker)
        if pos == -1:
            content = content.rstrip() + "\n\n" + entry
        else:
            insert_at = pos + len(marker)
            content = content[:insert_at] + "\n\n" + entry + content[insert_at:]
        path.write_text(content, encoding="utf-8")

    # ------------------------------------------------------------------
    # Scheduler integration — jobs run their prompt through a real turn
    # ------------------------------------------------------------------

    def _execute_job(self, job: Job) -> str:
        prompt = job.action.get("prompt") or job.description or job.id
        session = self.open_session(name=f"job:{job.id}")
        result = self.turn(prompt, session)
        return result.reply

    def tick(self, now: datetime | None = None) -> list[RunResult]:
        return self.scheduler.ticks(now)

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------

    def context_report(self) -> dict[str, Any]:
        assembled = self.context.assemble()
        return {"sources": assembled.report(), "total_tokens": assembled.total_tokens}


def _remove_existing_entry(content: str, sid: str) -> str:
    """Drop a previous past_sessions entry for this session (re-finalization
    updates in place instead of duplicating)."""
    needle = f"· {sid} —"
    start = content.find(f"## ")
    while start != -1:
        end = content.find("\n## ", start + 1)
        block = content[start : end if end != -1 else len(content)]
        if needle in block.splitlines()[0]:
            tail = content[end:] if end != -1 else ""
            return content[:start].rstrip() + "\n\n" + tail.lstrip("\n")
        start = end if end == -1 else content.find("## ", end + 1)
    return content
