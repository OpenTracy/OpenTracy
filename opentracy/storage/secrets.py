"""Local file-backed secrets store for API keys.

Stores keys in ~/.opentracy/secrets.json and pushes them to the Go engine at runtime.
"""

from __future__ import annotations

import json
import os
import logging
from pathlib import Path
from typing import Optional

import httpx
from opentracy._env import env

logger = logging.getLogger(__name__)

_SECRETS_FILE = Path(
    env("SECRETS_FILE", Path.home() / ".opentracy" / "secrets.json")
)

# Go engine URL for pushing keys at runtime
_ENGINE_URL = env("ENGINE_URL", "http://localhost:8080")


def _load() -> dict[str, str]:
    """Load secrets from disk."""
    if not _SECRETS_FILE.exists():
        return {}
    try:
        return json.loads(_SECRETS_FILE.read_text())
    except Exception:
        return {}


def _save(secrets: dict[str, str]) -> None:
    """Persist secrets to disk."""
    _SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SECRETS_FILE.write_text(json.dumps(secrets, indent=2))


def _push_to_engine(provider: str, api_key: str) -> None:
    """Push a key to the running Go engine (best-effort, non-blocking)."""
    try:
        httpx.post(
            f"{_ENGINE_URL}/v1/config/keys",
            json={"provider": provider, "api_key": api_key},
            timeout=2.0,
        )
        logger.info(f"Pushed key for {provider} to Go engine")
    except Exception as e:
        logger.debug(f"Could not push key to Go engine (may not be running): {e}")


def _delete_from_engine(provider: str) -> None:
    """Remove a key from the running Go engine (best-effort)."""
    try:
        httpx.delete(f"{_ENGINE_URL}/v1/config/keys/{provider}", timeout=2.0)
    except Exception:
        pass


# --- Public API ---


def list_configured_providers() -> list[str]:
    """Return list of provider names that have keys configured."""
    return list(_load().keys())


def get_secret(provider: str) -> Optional[str]:
    """Return the API key for a provider, or None."""
    return _load().get(provider)


def set_secret(provider: str, api_key: str) -> None:
    """Save an API key and push it to the Go engine."""
    secrets = _load()
    secrets[provider] = api_key
    _save(secrets)
    _push_to_engine(provider, api_key)


def delete_secret(provider: str) -> bool:
    """Remove an API key. Returns True if it existed."""
    secrets = _load()
    if provider not in secrets:
        return False
    del secrets[provider]
    _save(secrets)
    _delete_from_engine(provider)
    return True


def push_all_to_engine() -> None:
    """Push all stored keys to the Go engine (call on startup)."""
    for provider, key in _load().items():
        _push_to_engine(provider, key)
