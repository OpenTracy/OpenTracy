from types import SimpleNamespace

import pytest

from harness.executor.promote import _manifest_verdict_dict
from harness.rollback.rollback import rollback_edits
from ledger.versioning import read_version, snapshot_agent


def _agent(tmp, version, x_content):
    a = tmp / "agent"
    (a / "pipeline").mkdir(parents=True)
    (a / "agent.yaml").write_text(f"agent:\n  version: {version}\n")
    (a / "pipeline" / "x.yaml").write_text(x_content)
    return a


def test_rollback_edits_is_snapshot_safe_and_bumps_version(tmp_path, monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(
        "harness.rollback.rollback.write_entry", lambda **kw: captured.update(kw)
    )
    versions = tmp_path / "versions"
    agent = _agent(tmp_path, "v0.0.1", "k: 10\n")
    snapshot_agent(agent, versions)  # the state we'll roll back to

    # Simulate a promote lineage: edit, add a file, move to v0.0.2, and snapshot
    # it — so the LIVE version already has a snapshot (the case where the old
    # snapshot-before-restore silently no-ops).
    (agent / "pipeline" / "x.yaml").write_text("k: 99\n")
    (agent / "pipeline" / "new.yaml").write_text("added: true\n")
    (agent / "agent.yaml").write_text("agent:\n  version: v0.0.2\n")
    snapshot_agent(agent, versions)

    out = rollback_edits(
        "v0.0.1",
        ["pipeline/x.yaml", "pipeline/new.yaml"],
        agent_dir=agent,
        versions_dir=versions,
    )

    # Files reverted to the v0.0.1 snapshot.
    assert (agent / "pipeline" / "x.yaml").read_text() == "k: 10\n"
    assert not (agent / "pipeline" / "new.yaml").exists()
    assert out["restored"] == ["pipeline/x.yaml"]
    assert out["removed"] == ["pipeline/new.yaml"]

    # Version was bumped: live agent.yaml and the ledger entry both advance.
    assert read_version(agent) == "v0.0.3"
    assert captured["agent_version_before"] == "v0.0.2"
    assert captured["agent_version_after"] == "v0.0.3"

    # The pre-rollback tree was actually snapshotted under the new version, not
    # a no-op: its content is the post-edit (k: 99) tree, so the rollback is
    # itself undoable.
    snapped = versions / "v0.0.3" / "agent" / "pipeline" / "x.yaml"
    assert snapped.exists()
    assert snapped.read_text() == "k: 99\n"


def test_rollback_edits_rejects_path_traversal(tmp_path, monkeypatch):
    monkeypatch.setattr("harness.rollback.rollback.write_entry", lambda **kw: None)
    versions = tmp_path / "versions"
    agent = _agent(tmp_path, "v0.0.1", "k: 10\n")
    snapshot_agent(agent, versions)

    secret = tmp_path / "secret.txt"
    secret.write_text("do not touch\n")

    out = rollback_edits(
        "v0.0.1",
        ["../secret.txt"],
        agent_dir=agent,
        versions_dir=versions,
    )

    assert secret.exists()
    assert "../secret.txt" not in out["restored"]
    assert "../secret.txt" not in out["removed"]
    assert "../secret.txt" in out["skipped"]


def test_rollback_edits_missing_snapshot_raises(tmp_path):
    agent = _agent(tmp_path, "v0.0.1", "k: 10\n")
    with pytest.raises(FileNotFoundError):
        rollback_edits("v9.9.9", ["pipeline/x.yaml"],
                       agent_dir=agent, versions_dir=tmp_path / "versions")


def test_manifest_verdict_dict_tolerates_string_verdict():
    stub = SimpleNamespace(
        verdict="rollback_and_pivot",
        fix_precision=0.0, fix_recall=0.0,
        regression_precision=0.0, regression_recall=0.0,
        realized_fixes=[], realized_regressions=[],
        unpredicted_regressions=[], net_fixes=0,
    )
    d = _manifest_verdict_dict(stub)
    assert d["verdict"] == "rollback_and_pivot"
