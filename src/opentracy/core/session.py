"""Session tree storage: JSONL sessions with in-place branching (ADR-0005).

Modeled on Pi's session format v3 (pi-mono session-manager.ts). Each session
is one JSONL file: a header line, then entries forming a TREE via id/parentId
— so you can branch from any earlier turn, keep alternatives in one file, and
rebuild the active conversation by walking leaf → root.

    sessions/agent/<timestamp>_<uuid>.jsonl

Entry types (Pi-compatible): session (header), message, compaction,
branch_summary, label, session_info, model_change, thinking_level_change,
custom (state, NOT in LLM context), custom_message (IS in LLM context).

Relation to the other planes:
- The TranscriptStore (ADR-0003) becomes the cross-session MIRROR/INDEX:
  pass one as `mirror` and every message entry is also written to SQLite —
  searchable across sessions, rebuildable from the JSONL files at any time.
- Compaction integrates with the ContextCompressor (ADR-0002): record its
  summary via append_compaction(); build_context_entries() then drops the
  compacted region and keeps everything from first_kept_entry_id on.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

Entry = dict[str, Any]
Message = dict[str, Any]

SESSION_VERSION = 3
SESSIONS_SUBDIR = Path("sessions") / "agent"


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SessionManager:
    """Owns one session file: appends, tree navigation, context building."""

    def __init__(
        self,
        cwd: str,
        header: Entry,
        entries: list[Entry] | None = None,
        path: Path | None = None,
        mirror: Any = None,  # TranscriptStore-compatible: begin_session/append
    ):
        self.cwd = cwd
        self.header = header
        self.path = path
        self._entries: list[Entry] = entries or []
        self._by_id: dict[str, Entry] = {e["id"]: e for e in self._entries}
        self._leaf_id: str | None = self._entries[-1]["id"] if self._entries else None
        self._mirror = mirror
        if mirror is not None:
            try:
                mirror.begin_session(session_id=self.session_id)
            except Exception:
                pass  # already mirrored (reopened session)

    # ------------------------------------------------------------------
    # Creation
    # ------------------------------------------------------------------

    @classmethod
    def create(
        cls, root: Path | str, mirror: Any = None, parent_session: str | None = None
    ) -> "SessionManager":
        root = Path(root)
        session_dir = root / SESSIONS_SUBDIR
        session_dir.mkdir(parents=True, exist_ok=True)
        header: Entry = {
            "type": "session",
            "version": SESSION_VERSION,
            "id": str(uuid.uuid4()),
            "timestamp": _now_iso(),
            "cwd": str(root),
        }
        if parent_session:
            header["parentSession"] = parent_session
        stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        path = session_dir / f"{stamp}_{header['id'][:8]}.jsonl"
        manager = cls(str(root), header, path=path, mirror=mirror)
        path.write_text(json.dumps(header, ensure_ascii=False) + "\n", encoding="utf-8")
        return manager

    @classmethod
    def open(cls, path: Path | str, mirror: Any = None) -> "SessionManager":
        path = Path(path)
        lines = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l]
        if not lines or lines[0].get("type") != "session":
            raise ValueError(f"not a session file: {path}")
        header, entries = lines[0], lines[1:]
        return cls(header.get("cwd", ""), header, entries, path=path, mirror=mirror)

    @classmethod
    def continue_recent(cls, root: Path | str, mirror: Any = None) -> "SessionManager":
        files = sorted((Path(root) / SESSIONS_SUBDIR).glob("*.jsonl"))
        if files:
            return cls.open(files[-1], mirror=mirror)
        return cls.create(root, mirror=mirror)

    @classmethod
    def in_memory(cls, cwd: str = ".") -> "SessionManager":
        header: Entry = {
            "type": "session",
            "version": SESSION_VERSION,
            "id": str(uuid.uuid4()),
            "timestamp": _now_iso(),
            "cwd": cwd,
        }
        return cls(cwd, header, path=None)

    # ------------------------------------------------------------------
    # Appending — every append chains from the current leaf
    # ------------------------------------------------------------------

    def _append(self, entry: Entry) -> str:
        entry.setdefault("id", _new_id())
        entry.setdefault("parentId", self._leaf_id)
        entry.setdefault("timestamp", _now_iso())
        self._entries.append(entry)
        self._by_id[entry["id"]] = entry
        self._leaf_id = entry["id"]
        if self.path is not None:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return entry["id"]

    def append_message(self, message: Message) -> str:
        entry_id = self._append({"type": "message", "message": message})
        if self._mirror is not None:
            self._mirror.append(self.session_id, message)
        return entry_id

    def append_compaction(
        self, summary: str, first_kept_entry_id: str, tokens_before: int,
        details: dict[str, Any] | None = None,
    ) -> str:
        entry: Entry = {
            "type": "compaction",
            "summary": summary,
            "firstKeptEntryId": first_kept_entry_id,
            "tokensBefore": tokens_before,
        }
        if details:
            entry["details"] = details
        return self._append(entry)

    def append_label(self, target_id: str, label: str | None) -> str:
        return self._append({"type": "label", "targetId": target_id, "label": label})

    def append_session_info(self, name: str) -> str:
        return self._append({"type": "session_info", "name": name})

    def append_model_change(self, provider: str, model_id: str) -> str:
        return self._append(
            {"type": "model_change", "provider": provider, "modelId": model_id}
        )

    def append_thinking_level_change(self, level: str) -> str:
        return self._append({"type": "thinking_level_change", "thinkingLevel": level})

    def append_custom(self, custom_type: str, data: Any = None) -> str:
        """Extension state — persisted, never enters LLM context."""
        return self._append({"type": "custom", "customType": custom_type, "data": data})

    def append_custom_message(
        self, custom_type: str, content: Any, display: bool = True
    ) -> str:
        """Extension-injected message — DOES enter LLM context."""
        return self._append(
            {
                "type": "custom_message",
                "customType": custom_type,
                "content": content,
                "display": display,
            }
        )

    # ------------------------------------------------------------------
    # Tree navigation
    # ------------------------------------------------------------------

    def get_leaf_id(self) -> str | None:
        return self._leaf_id

    def get_entry(self, entry_id: str) -> Entry:
        return self._by_id[entry_id]

    def get_entries(self) -> list[Entry]:
        return list(self._entries)

    def get_children(self, parent_id: str | None) -> list[Entry]:
        return [e for e in self._entries if e.get("parentId") == parent_id]

    def get_branch(self, from_id: str | None = None) -> list[Entry]:
        """Walk from an entry (default: leaf) to the root; returns leaf-first."""
        branch = []
        current = from_id if from_id is not None else self._leaf_id
        while current is not None:
            entry = self._by_id[current]
            branch.append(entry)
            current = entry.get("parentId")
        return branch

    def branch(self, entry_id: str) -> None:
        """Move the leaf to an earlier entry; the next append starts a new branch."""
        if entry_id not in self._by_id:
            raise KeyError(f"unknown entry: {entry_id}")
        self._leaf_id = entry_id

    def reset_leaf(self) -> None:
        self._leaf_id = None

    def branch_with_summary(self, entry_id: str, summary: str) -> str:
        """Branch, attaching an LLM summary of the path being abandoned."""
        from_id = self._leaf_id
        self.branch(entry_id)
        return self._append(
            {"type": "branch_summary", "fromId": from_id, "summary": summary}
        )

    # ------------------------------------------------------------------
    # Context building (Pi buildContextEntries/buildSessionContext)
    # ------------------------------------------------------------------

    def build_context_entries(self) -> list[Entry]:
        """Active path root→leaf, honoring the most recent compaction on it:
        the compaction entry comes first, then entries from firstKeptEntryId
        up to the compaction, then everything after it."""
        path = list(reversed(self.get_branch()))
        comp_idx = next(
            (i for i in range(len(path) - 1, -1, -1) if path[i]["type"] == "compaction"),
            None,
        )
        if comp_idx is None:
            return path
        comp = path[comp_idx]
        kept_ids = [e["id"] for e in path[:comp_idx]]
        try:
            kept_start = kept_ids.index(comp["firstKeptEntryId"])
        except ValueError:
            kept_start = comp_idx  # nothing kept before the compaction
        return [comp] + path[kept_start:comp_idx] + path[comp_idx + 1 :]

    def build_session_context(self) -> dict[str, Any]:
        """Messages + model settings for the LLM, from the active path."""
        provider = model = thinking_level = None
        for entry in reversed(self.get_branch()):  # root→leaf: last change wins
            if entry["type"] == "model_change":
                provider, model = entry.get("provider"), entry.get("modelId")
            elif entry["type"] == "thinking_level_change":
                thinking_level = entry.get("thinkingLevel")

        messages: list[Message] = []
        for entry in self.build_context_entries():
            kind = entry["type"]
            if kind == "message":
                messages.append(entry["message"])
            elif kind == "compaction":
                messages.append(
                    {
                        "role": "system",
                        "content": "[Context summary — earlier turns were compacted]\n"
                        + entry["summary"],
                    }
                )
            elif kind == "branch_summary":
                messages.append(
                    {
                        "role": "system",
                        "content": "[Branch summary — context from an abandoned path]\n"
                        + entry["summary"],
                    }
                )
            elif kind == "custom_message":
                messages.append({"role": "user", "content": entry["content"]})
            # custom / label / session_info / model_change: never in context
        return {
            "messages": messages,
            "provider": provider,
            "model": model,
            "thinking_level": thinking_level,
        }

    # ------------------------------------------------------------------
    # Session info & derived sessions
    # ------------------------------------------------------------------

    @property
    def session_id(self) -> str:
        return self.header["id"]

    def get_session_name(self) -> str | None:
        for entry in reversed(self._entries):
            if entry["type"] == "session_info":
                return entry.get("name")
        return None

    def is_persisted(self) -> bool:
        return self.path is not None

    def create_branched_session(
        self, leaf_id: str | None = None, root: Path | str | None = None
    ) -> "SessionManager":
        """Extract the branch ending at leaf_id (default: current leaf) into a
        NEW session file whose header records this one as parentSession.
        /fork and /clone are both this, with different leaf choices."""
        target_root = Path(root) if root is not None else Path(self.cwd)
        new = SessionManager.create(
            target_root,
            parent_session=str(self.path) if self.path else None,
        )
        for entry in reversed(self.get_branch(leaf_id)):  # root→leaf order
            copied = dict(entry)
            copied.pop("id", None), copied.pop("parentId", None), copied.pop("timestamp", None)
            new._append(copied)
        return new

    # ------------------------------------------------------------------
    # Listing (the /resume picker's data source)
    # ------------------------------------------------------------------

    @staticmethod
    def list(root: Path | str) -> list[dict[str, Any]]:
        """Sessions for a workspace, newest first: id, path, name, counts."""
        infos = []
        for path in sorted((Path(root) / SESSIONS_SUBDIR).glob("*.jsonl"), reverse=True):
            try:
                manager = SessionManager.open(path)
            except (ValueError, json.JSONDecodeError):
                continue
            messages = [e for e in manager.get_entries() if e["type"] == "message"]
            first_user = next(
                (e["message"].get("content") for e in messages
                 if e["message"].get("role") == "user"),
                None,
            )
            infos.append(
                {
                    "id": manager.session_id,
                    "path": path,
                    "name": manager.get_session_name(),
                    "first_message": first_user if isinstance(first_user, str) else None,
                    "message_count": len(messages),
                    "created_at": manager.header.get("timestamp"),
                }
            )
        return infos
