"""File-based alias registry for local-student deployments.

An *alias* is a logical model name (``"smart"``, ``"ticket-classifier"``)
that resolves to a trained :class:`opentracy.Student`. Once an alias is
registered, any call to ``opentracy.completion(model=<alias>, ...)`` gets
dispatched to the student's local inference path with no provider fee and
no HTTP hop.

This is the SDK-side half of the "alias swap" that closes the OpenTracy
pipeline. The engine-side registration (so a running Go gateway also
resolves the alias) lives on the REST API — ``/v1/models/register`` — and
is layered on top; see the self-host guide.

Storage layout
~~~~~~~~~~~~~~
The registry is a single JSON file at
``$OPENTRACY_DATA_HOME/aliases.json`` (default ``~/.opentracy/aliases.json``).
Writes are atomic (write-to-tempfile + rename) and guarded by a process-level
lock so concurrent ``ot.set_alias`` / ``Student.deploy`` calls from the same
process can't corrupt each other. File-system-level locking is intentionally
*not* done — if you need cross-process atomic updates, write a small wrapper
that grabs ``fcntl.flock`` around the read-modify-write cycle.

File schema
~~~~~~~~~~~
::

    {
      "version": 1,
      "aliases": {
        "smart": {
          "backend": "gguf",
          "model_path": "/abs/path/to/model.q4_k_m.gguf",
          "base_model": "unsloth/Llama-3.2-1B-Instruct",
          "metadata": {"task": "ticket-triage"},
          "registered_at": "2026-04-20T13:02:41Z"
        }
      }
    }
"""

from __future__ import annotations

import datetime as _dt
import json
import logging
import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Optional

from ._env import env

__all__ = [
    "AliasEntry",
    "AliasError",
    "registry_path",
    "list_aliases",
    "get_alias",
    "set_alias",
    "unset_alias",
]

logger = logging.getLogger(__name__)

_REGISTRY_VERSION = 1
_WRITE_LOCK = threading.RLock()


class AliasError(RuntimeError):
    """Raised for alias-registry problems (bad path, missing alias, etc.)."""


AliasEntry = dict[str, Any]
"""Minimal shape: ``{backend, model_path, base_model?, metadata?, registered_at}``."""


# ---------------------------------------------------------------------- #
# Path resolution
# ---------------------------------------------------------------------- #


def registry_path() -> Path:
    """Resolve the path to the aliases file.

    Priority:
      1. ``OPENTRACY_ALIASES_FILE`` env var (absolute path).
      2. ``$OPENTRACY_DATA_HOME/aliases.json`` if the data-home env var is set.
      3. ``~/.opentracy/aliases.json``.
    """
    override = env("ALIASES_FILE")
    if override:
        return Path(str(override)).expanduser()
    data_home = env("DATA_HOME")
    if data_home:
        return Path(str(data_home)).expanduser() / "aliases.json"
    return Path.home() / ".opentracy" / "aliases.json"


# ---------------------------------------------------------------------- #
# Load / save
# ---------------------------------------------------------------------- #


def _load_all() -> dict[str, AliasEntry]:
    """Read the registry, returning a dict. Empty if the file doesn't exist."""
    path = registry_path()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise AliasError(
            f"Alias registry at {path} is corrupt: {e}. "
            "Fix or delete the file to recover."
        ) from e
    if not isinstance(payload, dict):
        raise AliasError(f"Alias registry at {path} is not a JSON object.")
    version = payload.get("version", 1)
    if version != _REGISTRY_VERSION:
        logger.warning(
            "Alias registry version %s is newer than this SDK supports "
            "(%s); entries might be dropped.", version, _REGISTRY_VERSION,
        )
    raw = payload.get("aliases", {})
    if not isinstance(raw, dict):
        raise AliasError(f"Alias registry at {path} has malformed 'aliases'.")
    return {str(k): dict(v) for k, v in raw.items() if isinstance(v, dict)}


def _save_all(aliases: dict[str, AliasEntry]) -> None:
    """Atomically write ``aliases`` to the registry file."""
    path = registry_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": _REGISTRY_VERSION, "aliases": aliases}
    tmp = tempfile.NamedTemporaryFile(
        mode="w",
        dir=str(path.parent),
        prefix=path.name + ".",
        suffix=".tmp",
        delete=False,
    )
    try:
        json.dump(payload, tmp, indent=2)
        tmp.flush()
        os.fsync(tmp.fileno())
    finally:
        tmp.close()
    os.replace(tmp.name, path)


# ---------------------------------------------------------------------- #
# Public API
# ---------------------------------------------------------------------- #


def list_aliases() -> dict[str, AliasEntry]:
    """Return a snapshot of every alias currently registered."""
    with _WRITE_LOCK:
        return _load_all()


def get_alias(alias: str) -> Optional[AliasEntry]:
    """Return the entry for ``alias`` or ``None`` if it isn't registered."""
    aliases = list_aliases()
    entry = aliases.get(alias)
    return dict(entry) if entry else None


def set_alias(
    alias: str,
    *,
    backend: str,
    model_path: str,
    base_model: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AliasEntry:
    """Register ``alias`` to point at a local student artifact.

    Overwrites any existing entry for ``alias``. Returns the entry that
    was persisted.
    """
    if not alias or not isinstance(alias, str):
        raise AliasError(f"Alias must be a non-empty string; got {alias!r}")
    if backend not in ("peft", "gguf"):
        raise AliasError(f"Unsupported backend {backend!r}; use 'peft' or 'gguf'.")

    entry: AliasEntry = {
        "backend": backend,
        "model_path": str(Path(model_path).expanduser().resolve()),
        "base_model": base_model,
        "metadata": dict(metadata or {}),
        "registered_at": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }

    with _WRITE_LOCK:
        aliases = _load_all()
        aliases[alias] = entry
        _save_all(aliases)

    logger.info("Registered alias %r -> %s (%s)", alias, entry["model_path"], backend)
    return dict(entry)


def unset_alias(alias: str) -> bool:
    """Remove ``alias`` from the registry.

    Returns True if the alias was removed, False if it wasn't registered.
    """
    with _WRITE_LOCK:
        aliases = _load_all()
        if alias not in aliases:
            return False
        del aliases[alias]
        _save_all(aliases)
    logger.info("Unregistered alias %r", alias)
    return True
