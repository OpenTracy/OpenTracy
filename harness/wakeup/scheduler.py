"""Count-threshold wake-up scheduler (P15.3.9).

Hooked into ``runtime/store/traces.py:write_trace()``. Each trace bumps
a persisted counter; when the counter crosses ``threshold`` we fire a
fire-and-forget thread that calls ``run_wakeup()``. The lockfile
prevents concurrent wake-ups across processes; the daemonized thread
keeps ``/run`` non-blocking.

No cron, no fixed thresholds — Claude Code (the brain) decides whether
to actually propose a retrain. The scheduler just *invites* it via the
introspection prompt.
"""

from __future__ import annotations

import errno
import logging
import os
import threading
from pathlib import Path
from typing import Callable, Optional


logger = logging.getLogger("harness.wakeup.scheduler")


_DEFAULT_THRESHOLD = int(os.getenv("HARNESS_ROUTER_WAKEUP_N", "50"))
_COUNTER_DIR = Path(".harness")
_COUNTER_PATH = _COUNTER_DIR / "wakeup_counter.txt"  # legacy default (back-compat)
def _lock_path() -> Path:
    """Cross-process wakeup lock, namespaced per tenant so a busy tenant
    doesn't serialize another tenant's improvement passes on a shared host."""
    from runtime.tenant_context import get_active as _get_tenant

    return Path("/tmp") / f"opentracy_router_wakeup_{_get_tenant()}.lock"


# Module-level lock guards counter increments within a single process.
# Cross-process exclusion is via the per-tenant lockfile (``_lock_path()``).
_counter_lock = threading.Lock()

# Per-agent wakeup queue. ``_pending`` holds distinct agents awaiting their
# improvement run; ``_inflight`` holds the ones being improved right now. A
# flood of traces for one agent coalesces into a single run (it won't re-enqueue
# while pending or in flight); other agents still get their turn — the worker
# drains the queue one agent at a time under the cross-process lock.
_pending: set[str] = set()
_inflight: set[str] = set()
_queue_lock = threading.Lock()


def _counter_path_for(agent_id: str) -> Path:
    return _COUNTER_DIR / f"wakeup_counter_{agent_id}.txt"


class _LockHeldError(Exception):
    """Internal: another wake-up is currently running."""


# ---------------------------------------------------------------------------


def increment_trace_counter(*, counter_path: Optional[Path] = None) -> int:
    """Bump the persisted counter atomically; returns the new value."""
    path = counter_path or _COUNTER_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    with _counter_lock:
        n = 0
        if path.exists():
            try:
                raw = path.read_text().strip()
                n = int(raw or "0")
            except (OSError, ValueError):
                n = 0
        n += 1
        path.write_text(str(n))
        return n


def reset_trace_counter(*, counter_path: Optional[Path] = None) -> None:
    path = counter_path or _COUNTER_PATH
    with _counter_lock:
        try:
            path.write_text("0")
        except OSError:
            pass


def maybe_fire(
    agent_id: Optional[str] = None,
    *,
    threshold: Optional[int] = None,
    counter_path: Optional[Path] = None,
    lock_path: Optional[Path] = None,
    runner: Optional[Callable[[], None]] = None,
) -> None:
    """Bump an agent's wakeup counter; on threshold, enqueue it and ensure the
    serialized worker is draining the queue.

    Returns instantly — it's called from the trace write path. ``agent_id``
    defaults to the active agent in the current context, so each agent's traces
    drive its own counter. One agent is improved at a time (cross-process
    lockfile); per-agent counters mean a busy agent doesn't starve the others.

    Args:
        agent_id: Agent to count/improve (default: the active agent).
        threshold: Override ``HARNESS_ROUTER_WAKEUP_N`` env default.
        counter_path / lock_path: Override defaults (tests use this).
        runner: Override the ``run_wakeup`` callable (tests use this).
    """
    if agent_id is None:
        from runtime.agent_context import get_active

        agent_id = get_active()
    th = threshold if threshold is not None else _DEFAULT_THRESHOLD
    cpath = counter_path or _counter_path_for(agent_id)
    lpath = lock_path or _lock_path()

    n = increment_trace_counter(counter_path=cpath)
    if n < th:
        return
    reset_trace_counter(counter_path=cpath)

    if not _enqueue(agent_id):
        return  # already pending or in flight — coalesce into the running pass

    fn = runner or _default_runner

    # Become the worker if no one holds the cross-process lock; otherwise the
    # running worker will drain what we just enqueued.
    try:
        _acquire_lock(lpath)
    except _LockHeldError:
        logger.info("wakeup enqueued for %s; a worker is already draining", agent_id)
        return

    thread = threading.Thread(
        target=_drain_with_release,
        args=(lpath, fn),
        daemon=True,
        name="agent-wakeup",
    )
    thread.start()


def _enqueue(agent_id: str) -> bool:
    """Add an agent to the pending set unless it's already pending/in flight."""
    with _queue_lock:
        if agent_id in _pending or agent_id in _inflight:
            return False
        _pending.add(agent_id)
        return True


def _next_agent() -> Optional[str]:
    with _queue_lock:
        if not _pending:
            return None
        agent_id = _pending.pop()
        _inflight.add(agent_id)
        return agent_id


def _finish_agent(agent_id: str) -> None:
    with _queue_lock:
        _inflight.discard(agent_id)


def _drain_with_release(lock_path: Path, runner: Callable[[], None]) -> None:
    """Run the queued agents one at a time, each in its own pinned context,
    then release the cross-process lock."""
    from runtime.agent_context import set_active

    try:
        while True:
            agent_id = _next_agent()
            if agent_id is None:
                break
            set_active(agent_id)
            try:
                runner()
            except Exception as e:  # pragma: no cover — defensive
                logger.exception("wakeup run failed for %s: %s", agent_id, e)
            finally:
                _finish_agent(agent_id)
    finally:
        _release_lock(lock_path)


# ---------------------------------------------------------------------------
# Lockfile (cross-process) — fcntl on POSIX, no-op stub elsewhere.
# ---------------------------------------------------------------------------


def _acquire_lock(path: Path) -> None:
    """Create the lockfile with O_EXCL. Atomic on POSIX.

    Stores the current PID. Before raising _LockHeldError on collision,
    we check whether the holder PID is still alive — if not, the lock is
    stale (left over from a crashed wakeup) and we sweep it, then retry.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        # Stale lock detection — was the holder PID killed?
        if _sweep_stale_lock(path):
            try:
                fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            except FileExistsError as e2:
                raise _LockHeldError(f"lock held (after sweep retry): {path}") from e2
        else:
            raise _LockHeldError(f"lock held: {path}") from None
    try:
        os.write(fd, str(os.getpid()).encode())
    finally:
        os.close(fd)


def _sweep_stale_lock(path: Path) -> bool:
    """If the lockfile's PID isn't a live process, delete it and return True."""
    try:
        raw = path.read_text().strip()
    except OSError:
        return False
    try:
        held_pid = int(raw)
    except ValueError:
        # Corrupt lockfile content — treat as stale.
        try:
            path.unlink()
            logger.warning("stale lockfile (corrupt PID) swept: %s", path)
            return True
        except OSError:
            return False

    if _pid_alive(held_pid):
        return False

    try:
        path.unlink()
        logger.warning("stale lockfile from PID %d swept: %s", held_pid, path)
        return True
    except OSError:
        return False


def _pid_alive(pid: int) -> bool:
    """Return True if a process with that PID is alive (POSIX kill -0)."""
    try:
        os.kill(pid, 0)
    except OSError as e:
        # ESRCH = no such process; EPERM = exists but we lack permission.
        if getattr(e, "errno", None) == errno.EPERM:  # process exists, owned by another user
            return True
        return False
    return True


def _release_lock(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    except OSError as e:
        logger.warning("lock release failed (non-fatal): %s", e)


# ---------------------------------------------------------------------------


def _default_runner() -> None:
    """Default wakeup body — calls ``run_wakeup`` for the active agent, but
    only if that agent's ``improvement.yaml`` has it enabled.

    Defined as a module-level function (not a lambda) so tests can swap it
    out via ``runner=`` arg. The worker has already pinned the active agent.
    """
    from runtime.agent_context import get_active

    agent_id = get_active()
    try:
        from runtime.agents.improvement import load

        cfg = load(agent_id)
        if not cfg.enabled or cfg.transport == "disabled":
            logger.info("wakeup skipped: improvement disabled for %s", agent_id)
            return
    except Exception:
        pass  # default to enabled if the config can't be read

    from harness.wakeup.runner import run_wakeup

    run_wakeup()
