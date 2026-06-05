import pytest

from harness.rollback.rollback import rollback_edits
from ledger.versioning import snapshot_agent


def _agent(tmp, version, x_content):
    a = tmp / "agent"
    (a / "pipeline").mkdir(parents=True)
    (a / "agent.yaml").write_text(f"agent:\n  version: {version}\n")
    (a / "pipeline" / "x.yaml").write_text(x_content)
    return a


def test_rollback_edits_restores_and_removes(tmp_path, monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(
        "harness.rollback.rollback.write_entry", lambda **kw: captured.update(kw)
    )
    versions = tmp_path / "versions"
    agent = _agent(tmp_path, "v0.0.1", "k: 10\n")
    snapshot_agent(agent, versions)

    # mutate the tracked file + add a new one, then move to a new version
    (agent / "pipeline" / "x.yaml").write_text("k: 99\n")
    (agent / "pipeline" / "new.yaml").write_text("added: true\n")
    (agent / "agent.yaml").write_text("agent:\n  version: v0.0.2\n")

    out = rollback_edits(
        "v0.0.1",
        ["pipeline/x.yaml", "pipeline/new.yaml"],
        agent_dir=agent,
        versions_dir=versions,
    )

    assert (agent / "pipeline" / "x.yaml").read_text() == "k: 10\n"   # restored
    assert not (agent / "pipeline" / "new.yaml").exists()             # removed
    assert out == {"restored": ["pipeline/x.yaml"], "removed": ["pipeline/new.yaml"]}
    assert captured["kind"] == "rollback"
    assert captured["payload"]["version"] == "v0.0.1"


def test_rollback_edits_missing_snapshot_raises(tmp_path):
    agent = _agent(tmp_path, "v0.0.1", "k: 10\n")
    with pytest.raises(FileNotFoundError):
        rollback_edits("v9.9.9", ["pipeline/x.yaml"],
                       agent_dir=agent, versions_dir=tmp_path / "versions")
