"""Active-agent pointer (P2.1).

Every storage module that previously wrote to a flat path
(``ledger/entries/...``, ``traces/raw/...``) now writes to a partition
under the currently-active agent (``ledger/<agent_id>/entries/...``).
This module is the single source of truth for "which agent are we
writing as right now."

Backed by a :class:`contextvars.ContextVar` so concurrent requests (asyncio
tasks / threads) each get their own active agent — a request serving agent A
must never see agent B's pointer leak in from another in-flight request.

Set on three paths:
  - server lifespan after ``ensure_bootstrapped()`` resolves the
    registry's active pointer
  - per request, pinned by the handler before it serves
  - ``OPENTRACY_AGENT_ID`` env var (tests + CLI override)

Reads always succeed: if nothing was set and no env override exists,
the resolver returns ``_default`` so writes still land in a partition
that ``ensure_bootstrapped()`` has prepared.
"""

from __future__ import annotations

import contextvars
import os
from typing import Optional

_DEFAULT_AGENT_ID = "_default"
_ENV_VAR = "OPENTRACY_AGENT_ID"

_active_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "opentracy_active_agent", default=None
)


def set_active(agent_id: Optional[str]) -> None:
    """Pin the active agent for the current context. ``None`` clears it so the
    next read falls back to env or default — useful for tests."""
    _active_var.set(agent_id)


def get_active(default: str = _DEFAULT_AGENT_ID) -> str:
    """Resolve the current agent id. Order:
       1. context-local ``set_active`` value
       2. ``OPENTRACY_AGENT_ID`` env var
       3. ``default``
    """
    current = _active_var.get()
    if current:
        return current
    env = os.environ.get(_ENV_VAR, "").strip()
    if env:
        return env
    return default


def __getattr__(name: str):
    # Back-compat read shim: legacy callers/tests that read ``_active`` see the
    # ContextVar's current binding. Writes should go through ``set_active``.
    if name == "_active":
        return _active_var.get()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
