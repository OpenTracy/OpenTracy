"""Env-var lookup with LUNAR_* → OPENTRACY_* backwards-compat fallback.

Usage:
    from opentracy._env import env
    url = env("ENGINE_URL", "http://localhost:8080")

Reads OPENTRACY_<name> first; if absent, falls back to LUNAR_<name> and emits a
one-time DeprecationWarning per legacy key. Users with existing .env files keep
working; new deployments use the new prefix.
"""

from __future__ import annotations

import os
import warnings

_warned: set[str] = set()


def env(name: str, default: object | None = None, *, required: bool = False) -> object | None:
    """Return value of OPENTRACY_<name>, falling back to LUNAR_<name>.

    `name` is the bare suffix (e.g. "ENGINE_URL", not "OPENTRACY_ENGINE_URL").
    When only the legacy LUNAR_ variable is set, a DeprecationWarning fires once
    per process for that key. If `required=True` and neither is set, raises
    KeyError instead of returning `default`.
    """
    new_key = f"OPENTRACY_{name}"
    old_key = f"LUNAR_{name}"

    if new_key in os.environ:
        return os.environ[new_key]

    if old_key in os.environ:
        if old_key not in _warned:
            warnings.warn(
                f"{old_key} is deprecated; use {new_key} instead",
                DeprecationWarning,
                stacklevel=2,
            )
            _warned.add(old_key)
        return os.environ[old_key]

    if required:
        raise KeyError(new_key)
    return default


def env_in_environ(name: str) -> bool:
    """True if either OPENTRACY_<name> or LUNAR_<name> is set."""
    return f"OPENTRACY_{name}" in os.environ or f"LUNAR_{name}" in os.environ
