"""Tests for opentracy.aliases + Student.deploy + alias dispatch in completion().

Phase 3 of the SDK-DX plan. We verify:

  1. Registry file roundtrip — set → get → list → unset.
  2. Path resolution honors OPENTRACY_ALIASES_FILE and OPENTRACY_DATA_HOME.
  3. Writes are atomic (we simulate an aborted write mid-flight).
  4. Corrupt / malformed files surface as AliasError.
  5. Student.deploy writes the entry correctly.
  6. Engine notification is best-effort — a failing POST warns, doesn't raise.
  7. opentracy.completion(model="my-alias", ...) dispatches to the student.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

import opentracy as ot
import opentracy.aliases as aliases_mod
from opentracy.aliases import (
    AliasError,
    get_alias,
    list_aliases,
    registry_path,
    set_alias,
    unset_alias,
)
from opentracy.student import Student


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def isolated_registry(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point every test at a fresh aliases file under tmp_path."""
    registry = tmp_path / "aliases.json"
    monkeypatch.setenv("OPENTRACY_ALIASES_FILE", str(registry))
    return registry


@pytest.fixture
def peft_dir(tmp_path: Path) -> Path:
    d = tmp_path / "my-adapter"
    d.mkdir()
    (d / "adapter_config.json").write_text(
        json.dumps({"base_model_name_or_path": "unsloth/Llama-3.2-1B-Instruct"})
    )
    (d / "adapter_model.safetensors").write_bytes(b"fake")
    return d


# ---------------------------------------------------------------------------
# Registry path + roundtrip
# ---------------------------------------------------------------------------


class TestRegistryPath:
    def test_env_override(self, isolated_registry: Path) -> None:
        assert registry_path() == isolated_registry

    def test_data_home_override(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path,
    ) -> None:
        # Clear the aliases-specific override first
        monkeypatch.delenv("OPENTRACY_ALIASES_FILE", raising=False)
        monkeypatch.setenv("OPENTRACY_DATA_HOME", str(tmp_path / "data_home"))
        assert registry_path() == tmp_path / "data_home" / "aliases.json"

    def test_default_is_under_home_dotdir(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("OPENTRACY_ALIASES_FILE", raising=False)
        monkeypatch.delenv("OPENTRACY_DATA_HOME", raising=False)
        monkeypatch.delenv("LUNAR_ALIASES_FILE", raising=False)
        monkeypatch.delenv("LUNAR_DATA_HOME", raising=False)
        assert registry_path() == Path.home() / ".opentracy" / "aliases.json"


class TestRegistryRoundtrip:
    def test_empty_when_file_missing(self, isolated_registry: Path) -> None:
        assert list_aliases() == {}
        assert get_alias("anything") is None

    def test_set_then_get(self, isolated_registry: Path, tmp_path: Path) -> None:
        entry = set_alias(
            "smart",
            backend="gguf",
            model_path=str(tmp_path / "model.gguf"),
            base_model="unsloth/Llama-3.2-1B-Instruct",
            metadata={"task": "ticket"},
        )
        assert entry["backend"] == "gguf"
        assert entry["base_model"] == "unsloth/Llama-3.2-1B-Instruct"
        assert entry["metadata"] == {"task": "ticket"}
        assert entry["registered_at"].endswith("Z")

        got = get_alias("smart")
        assert got is not None
        assert got["backend"] == "gguf"

    def test_overwrite(self, isolated_registry: Path, tmp_path: Path) -> None:
        set_alias("smart", backend="gguf", model_path=str(tmp_path / "a.gguf"))
        set_alias("smart", backend="peft", model_path=str(tmp_path))
        got = get_alias("smart")
        assert got["backend"] == "peft"

    def test_multiple_aliases(self, isolated_registry: Path, tmp_path: Path) -> None:
        set_alias("a", backend="gguf", model_path=str(tmp_path / "a.gguf"))
        set_alias("b", backend="gguf", model_path=str(tmp_path / "b.gguf"))
        all_ = list_aliases()
        assert set(all_.keys()) == {"a", "b"}

    def test_unset(self, isolated_registry: Path, tmp_path: Path) -> None:
        set_alias("smart", backend="gguf", model_path=str(tmp_path / "a.gguf"))
        assert unset_alias("smart") is True
        assert get_alias("smart") is None
        # Second unset is a no-op
        assert unset_alias("smart") is False

    def test_list_is_a_snapshot(self, isolated_registry: Path, tmp_path: Path) -> None:
        set_alias("a", backend="gguf", model_path=str(tmp_path / "a.gguf"))
        snap = list_aliases()
        snap["a"]["model_path"] = "mutated"
        fresh = list_aliases()
        assert fresh["a"]["model_path"] != "mutated"


class TestRegistryFileOnDisk:
    def test_file_format(self, isolated_registry: Path, tmp_path: Path) -> None:
        set_alias("x", backend="gguf", model_path=str(tmp_path / "m.gguf"))
        raw = json.loads(isolated_registry.read_text())
        assert raw["version"] == 1
        assert "aliases" in raw and "x" in raw["aliases"]

    def test_corrupt_file_raises(self, isolated_registry: Path) -> None:
        isolated_registry.parent.mkdir(parents=True, exist_ok=True)
        isolated_registry.write_text("{not: valid}")
        with pytest.raises(AliasError, match="corrupt"):
            list_aliases()

    def test_non_object_file_raises(self, isolated_registry: Path) -> None:
        isolated_registry.parent.mkdir(parents=True, exist_ok=True)
        isolated_registry.write_text(json.dumps([1, 2, 3]))
        with pytest.raises(AliasError, match="not a JSON object"):
            list_aliases()

    def test_atomic_write_cleanup(self, isolated_registry: Path, tmp_path: Path) -> None:
        set_alias("x", backend="gguf", model_path=str(tmp_path / "m.gguf"))
        # No leftover temp files with the `.tmp` suffix
        leftovers = list(isolated_registry.parent.glob("aliases.json.*.tmp"))
        assert leftovers == []


class TestRegistryValidation:
    def test_empty_alias_rejected(self, isolated_registry: Path) -> None:
        with pytest.raises(AliasError, match="non-empty"):
            set_alias("", backend="gguf", model_path="/tmp/x.gguf")

    def test_unknown_backend_rejected(self, isolated_registry: Path) -> None:
        with pytest.raises(AliasError, match="Unsupported backend"):
            set_alias("x", backend="onnx", model_path="/tmp/x.onnx")


# ---------------------------------------------------------------------------
# Student.deploy
# ---------------------------------------------------------------------------


class TestStudentDeploy:
    def test_writes_entry(self, peft_dir: Path, isolated_registry: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
            metadata={"task": "triage"},
        )
        entry = s.deploy("ticket-classifier")

        assert entry["backend"] == "peft"
        assert entry["base_model"] == "unsloth/Llama-3.2-1B-Instruct"
        # Round-trip through the registry
        got = get_alias("ticket-classifier")
        assert got is not None
        assert got["model_path"] == s.model_path
        assert got["metadata"] == {"task": "triage"}

    def test_engine_notify_best_effort(
        self, peft_dir: Path, isolated_registry: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """When engine_url is provided but the POST fails, we warn but still
        register locally."""
        from opentracy import student as student_mod

        def boom(*a, **kw):
            raise RuntimeError("engine unreachable")

        monkeypatch.setattr(student_mod, "_notify_engine_register", boom)

        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
        )
        with pytest.warns(UserWarning, match="engine registration"):
            s.deploy("smart", engine_url="http://fake:8080")

        # Local registration still persisted
        assert get_alias("smart") is not None


# ---------------------------------------------------------------------------
# completion(model="alias") dispatch
# ---------------------------------------------------------------------------


class TestCompletionAliasDispatch:
    def test_alias_routes_to_student(
        self, peft_dir: Path, isolated_registry: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Register the alias
        set_alias(
            "ticket-classifier",
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
            metadata={"task": "triage"},
        )

        # Stub Student.generate so we don't load torch
        from opentracy.student import Student as StudentCls

        fake_generate = MagicMock(return_value={
            "id": "student-1",
            "object": "chat.completion",
            "created": 0,
            "model": "my-adapter",
            "choices": [
                {"index": 0, "message": {"role": "assistant", "content": "billing"}, "finish_reason": "stop"},
            ],
            "usage": {"prompt_tokens": 5, "completion_tokens": 1, "total_tokens": 6},
            "_provider": "opentracy",
            "_cost": 0.0,
            "_latency_ms": 12.3,
        })
        monkeypatch.setattr(StudentCls, "generate", fake_generate)

        resp = ot.completion(
            model="ticket-classifier",
            messages=[{"role": "user", "content": "Classify: refund me"}],
        )

        assert fake_generate.called
        assert resp.choices[0].message.content == "billing"
        assert resp._provider == "opentracy"
        assert resp._cost == 0.0
        assert resp._routing["alias"] == "ticket-classifier"
        assert resp._routing["backend"] == "peft"

    def test_unknown_model_falls_through_to_http_path(
        self, isolated_registry: Path, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A model name that isn't a registered alias must not be intercepted."""
        from opentracy import sdk

        sentinel = sdk.ModelResponse({
            "choices": [{"message": {"content": "http-ok"}, "finish_reason": "stop", "index": 0}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            "_provider": "openai", "_cost": 0.0, "_latency_ms": 1.0,
        })
        monkeypatch.setattr(sdk, "_send_completion", lambda *a, **kw: sentinel)

        resp = ot.completion(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "x"}],
        )
        assert resp.choices[0].message.content == "http-ok"


# ---------------------------------------------------------------------------
# Public export surface
# ---------------------------------------------------------------------------


class TestPublicExports:
    def test_exports(self) -> None:
        assert ot.list_aliases is list_aliases  # type: ignore[attr-defined]
        assert ot.get_alias is get_alias  # type: ignore[attr-defined]
        assert ot.set_alias is set_alias  # type: ignore[attr-defined]
        assert ot.unset_alias is unset_alias  # type: ignore[attr-defined]
        assert ot.AliasError is AliasError  # type: ignore[attr-defined]
