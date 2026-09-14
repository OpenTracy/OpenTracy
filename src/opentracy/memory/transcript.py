"""Transcript memory: verbatim SQLite record of every interactive message.

This is the second of OpenTracy's three memory planes (ADR-0003):

    1. Control documents (.md)  — curated views, always in context
       (soul.md, memory/user.md, memory/memory.md, sessions/past_sessions.md)
    2. Transcript store (THIS)  — complete, append-only record of every
       session's messages; queried on demand, never loaded wholesale
    3. External providers        — Mem0 / Supermemory / etc., behind the
       ExternalMemory protocol (opentracy.memory.external); deferred

Invariants:
- APPEND-ONLY. Context compression rewrites the *working* message list the
  model sees; it never touches this record. The transcript is what actually
  happened — the source of truth for session summaries (past_sessions.md),
  offline evals, and future recall.
- LOSSLESS. Messages round-trip exactly: role + content (any JSON shape) +
  every extra key (tool_calls, tool_call_id, ...) survive verbatim.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

Message = dict[str, Any]

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    summary    TEXT,
    metadata   TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL REFERENCES sessions(id),
    seq        INTEGER NOT NULL,
    role       TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    extra      TEXT,
    created_at TEXT    NOT NULL,
    UNIQUE (session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, seq);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TranscriptStore:
    """SQLite-backed session transcript store.

    One store per workspace (default: sessions/transcripts.db). A single
    connection, WAL mode; safe for one process — the session loop owns it.
    """

    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(_SCHEMA)

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def begin_session(
        self, session_id: str | None = None, metadata: dict[str, Any] | None = None
    ) -> str:
        session_id = session_id or f"s-{uuid.uuid4().hex[:12]}"
        with self._conn:
            self._conn.execute(
                "INSERT INTO sessions (id, started_at, metadata) VALUES (?, ?, ?)",
                (session_id, _now(), json.dumps(metadata or {}, ensure_ascii=False)),
            )
        return session_id

    def end_session(self, session_id: str, summary: str | None = None) -> None:
        """Close a session. `summary` is the session-end digest that also
        feeds sessions/past_sessions.md (context stack position 6)."""
        with self._conn:
            cur = self._conn.execute(
                "UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ?",
                (_now(), summary, session_id),
            )
        if cur.rowcount == 0:
            raise KeyError(f"unknown session: {session_id}")

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------

    def append(self, session_id: str, message: Message) -> int:
        """Persist one message; returns its per-session sequence number."""
        role = message.get("role")
        if not role:
            raise ValueError("message must have a role")
        content = json.dumps(message.get("content"), ensure_ascii=False)
        extra = {k: v for k, v in message.items() if k not in ("role", "content")}
        with self._conn:
            row = self._conn.execute(
                "SELECT COALESCE(MAX(seq), 0) + 1 FROM messages WHERE session_id = ?",
                (session_id,),
            ).fetchone()
            seq = row[0]
            self._conn.execute(
                "INSERT INTO messages (session_id, seq, role, content, extra, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    session_id,
                    seq,
                    role,
                    content,
                    json.dumps(extra, ensure_ascii=False) if extra else None,
                    _now(),
                ),
            )
        return seq

    def get_transcript(self, session_id: str) -> list[Message]:
        """Reconstruct the full transcript, in order, losslessly."""
        rows = self._conn.execute(
            "SELECT role, content, extra FROM messages"
            " WHERE session_id = ? ORDER BY seq",
            (session_id,),
        ).fetchall()
        transcript = []
        for row in rows:
            msg: Message = {"role": row["role"], "content": json.loads(row["content"])}
            if row["extra"]:
                msg.update(json.loads(row["extra"]))
            transcript.append(msg)
        return transcript

    def message_count(self, session_id: str) -> int:
        row = self._conn.execute(
            "SELECT COUNT(*) FROM messages WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row[0]

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def list_sessions(self, limit: int = 50) -> list[dict[str, Any]]:
        """Most recent sessions first, with message counts."""
        rows = self._conn.execute(
            "SELECT s.id, s.started_at, s.ended_at, s.summary, s.metadata,"
            "       COUNT(m.id) AS message_count"
            " FROM sessions s LEFT JOIN messages m ON m.session_id = s.id"
            " GROUP BY s.id ORDER BY s.started_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "started_at": r["started_at"],
                "ended_at": r["ended_at"],
                "summary": r["summary"],
                "metadata": json.loads(r["metadata"]),
                "message_count": r["message_count"],
            }
            for r in rows
        ]

    def search_messages(self, text: str, limit: int = 20) -> list[dict[str, Any]]:
        """Simple substring search across all transcripts (recall on demand).
        Semantic search arrives with the external/vector plane later."""
        pattern = f"%{text}%"
        rows = self._conn.execute(
            "SELECT session_id, seq, role, content, created_at FROM messages"
            " WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
            (pattern, limit),
        ).fetchall()
        return [
            {
                "session_id": r["session_id"],
                "seq": r["seq"],
                "role": r["role"],
                "content": json.loads(r["content"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    # ------------------------------------------------------------------

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "TranscriptStore":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
