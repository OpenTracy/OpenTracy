"""distill_session keeps rubric + manifest verification signals separate."""

from __future__ import annotations

from types import SimpleNamespace

import harness.observability.distillation as dist


def _manifest(cid):
    return SimpleNamespace(
        id=cid, mutations=[], parent_version="v0.0.1",
        created_at="2026-01-01T00:00:00Z",
    )


def _entry(cid, payload):
    return SimpleNamespace(
        kind="promote", candidate_id=cid, agent_version_after="v0.0.2",
        payload=payload, entry_id="E-1", timestamp="2026-01-01T00:01:00Z",
    )


def _patch(monkeypatch, cid, payload):
    monkeypatch.setattr(dist, "list_candidates", lambda: [_manifest(cid)])
    monkeypatch.setattr(dist, "_all_results", lambda: [])
    monkeypatch.setattr(dist, "read_entries", lambda **k: [_entry(cid, payload)])
    monkeypatch.setattr(dist, "read_lessons", lambda **k: [])


def test_distill_preserves_both_verification_and_manifest(tmp_path, monkeypatch):
    cid = "cand-both"
    payload = {
        "prediction": {"rubric": "overall", "expected_delta": 0.1, "rationale": "x"},
        "verification": {"rubric": "overall", "actual_delta": 0.2, "verdict": "verified"},
        "manifest_verdict": {"verdict": "keep", "fix_recall": 1.0, "regression_recall": 0.0},
    }
    _patch(monkeypatch, cid, payload)

    sess = dist.distill_session(cid, sessions_dir=tmp_path)

    # Neither signal clobbers the other.
    assert sess.actual["rubric"]["actual_delta"] == 0.2
    assert sess.actual["manifest"]["verdict"] == "keep"
    assert sess.prediction_verified is True


def test_distill_verification_only(tmp_path, monkeypatch):
    cid = "cand-v"
    payload = {"verification": {"rubric": "overall", "actual_delta": -0.1, "verdict": "wrong"}}
    _patch(monkeypatch, cid, payload)

    sess = dist.distill_session(cid, sessions_dir=tmp_path)

    assert "rubric" in sess.actual
    assert "manifest" not in sess.actual
    assert sess.prediction_verified is False


def test_distill_manifest_only(tmp_path, monkeypatch):
    cid = "cand-m"
    payload = {"manifest_verdict": {"verdict": "rollback_and_pivot", "fix_recall": 0.0,
                                    "regression_recall": 0.0}}
    _patch(monkeypatch, cid, payload)

    sess = dist.distill_session(cid, sessions_dir=tmp_path)

    assert "manifest" in sess.actual
    assert "rubric" not in sess.actual
    assert sess.prediction_verified is False
