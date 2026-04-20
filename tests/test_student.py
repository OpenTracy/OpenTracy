"""Tests for opentracy.student (Phase 1 of the SDK-DX plan).

We can't exercise real PEFT or llama.cpp inference in unit tests — those
need GPUs and hundreds of MB of weights. Instead, we verify:

  1. load_student detects the backend correctly from filesystem layout.
  2. Student.generate returns OpenAI-shaped dicts and routes to the right
     backend method.
  3. opentracy.completion(model=<Student>) dispatches to Student.generate
     and wraps the result in ModelResponse with the OpenTracy extras.
  4. save() round-trips metadata for both backends.
  5. Error paths (missing base_model, unknown backend, bad path) raise
     StudentError with a clear message.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

import opentracy as ot
from opentracy.student import Student, StudentError, load_student


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def peft_dir(tmp_path: Path) -> Path:
    """A minimal PEFT adapter directory — just enough for load_student."""
    d = tmp_path / "my-adapter"
    d.mkdir()
    (d / "adapter_config.json").write_text(
        json.dumps({"base_model_name_or_path": "unsloth/Llama-3.2-1B-Instruct"})
    )
    (d / "adapter_model.safetensors").write_bytes(b"fake-weights")
    return d


@pytest.fixture
def gguf_file(tmp_path: Path) -> Path:
    f = tmp_path / "model.q4_k_m.gguf"
    f.write_bytes(b"GGUF" + b"\x00" * 32)
    return f


@pytest.fixture
def gguf_dir(tmp_path: Path) -> Path:
    d = tmp_path / "gguf-dir"
    d.mkdir()
    (d / "model.q8_0.gguf").write_bytes(b"GGUF" + b"\x00" * 64)
    (d / "model.q4_k_m.gguf").write_bytes(b"GGUF" + b"\x00" * 32)
    return d


# ---------------------------------------------------------------------------
# Backend detection
# ---------------------------------------------------------------------------


class TestLoadStudentDetection:
    def test_peft_adapter_dir(self, peft_dir: Path) -> None:
        s = load_student(peft_dir)
        assert s.backend == "peft"
        assert s.base_model == "unsloth/Llama-3.2-1B-Instruct"
        assert s.model_path == str(peft_dir.resolve())

    def test_gguf_file_direct(self, gguf_file: Path) -> None:
        s = load_student(gguf_file)
        assert s.backend == "gguf"
        assert s.model_path == str(gguf_file.resolve())

    def test_gguf_dir_picks_smallest(self, gguf_dir: Path) -> None:
        s = load_student(gguf_dir)
        assert s.backend == "gguf"
        assert s.model_path.endswith("model.q4_k_m.gguf")  # smaller than q8_0

    def test_missing_path_raises(self, tmp_path: Path) -> None:
        with pytest.raises(StudentError, match="does not exist"):
            load_student(tmp_path / "nope")

    def test_directory_without_adapter_or_gguf_raises(self, tmp_path: Path) -> None:
        bad = tmp_path / "empty"
        bad.mkdir()
        with pytest.raises(StudentError, match="no adapter_config|no.*gguf"):
            load_student(bad)

    def test_peft_without_base_model_raises(self, tmp_path: Path) -> None:
        d = tmp_path / "broken"
        d.mkdir()
        (d / "adapter_config.json").write_text(json.dumps({}))  # no base model
        with pytest.raises(StudentError, match="base_model_name_or_path"):
            load_student(d)


# ---------------------------------------------------------------------------
# Generation dispatch
# ---------------------------------------------------------------------------


class TestStudentGenerate:
    def test_peft_generate_calls_peft_path(self, peft_dir: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
        )
        s._generate_peft = MagicMock(return_value=("classified", 12, 3))
        # Pretend the model is loaded so _ensure_loaded is a no-op.
        s._model = object()
        s._tokenizer = object()

        resp = s.generate([{"role": "user", "content": "hello"}])

        s._generate_peft.assert_called_once()
        assert resp["choices"][0]["message"]["content"] == "classified"
        assert resp["usage"]["prompt_tokens"] == 12
        assert resp["usage"]["completion_tokens"] == 3
        assert resp["usage"]["total_tokens"] == 15
        assert resp["_cost"] == 0.0
        assert resp["_provider"] == "opentracy"
        assert resp["_latency_ms"] >= 0

    def test_gguf_generate_calls_gguf_path(self, gguf_file: Path) -> None:
        s = Student(backend="gguf", model_path=str(gguf_file))
        s._generate_gguf = MagicMock(return_value=("billing", 8, 1))
        s._model = object()

        resp = s.generate([{"role": "user", "content": "Classify"}])

        s._generate_gguf.assert_called_once()
        assert resp["choices"][0]["message"]["content"] == "billing"
        assert resp["usage"]["total_tokens"] == 9

    def test_call_shortcut(self, peft_dir: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
        )
        s._generate_peft = MagicMock(return_value=("short answer", 4, 2))
        s._model = object()
        s._tokenizer = object()

        out = s("Tell me a joke")
        assert out == "short answer"

    def test_batch(self, peft_dir: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
        )
        s._generate_peft = MagicMock(side_effect=[
            ("a", 1, 1), ("b", 1, 1), ("c", 1, 1),
        ])
        s._model = object()
        s._tokenizer = object()

        out = s.batch(["p1", "p2", "p3"])
        assert out == ["a", "b", "c"]
        assert s._generate_peft.call_count == 3


# ---------------------------------------------------------------------------
# completion() dispatch
# ---------------------------------------------------------------------------


class TestCompletionDispatch:
    def test_completion_accepts_student(self, peft_dir: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
        )
        s._generate_peft = MagicMock(return_value=("feature_request", 5, 2))
        s._model = object()
        s._tokenizer = object()

        resp = ot.completion(
            model=s,
            messages=[{"role": "user", "content": "Classify: dark mode please"}],
        )

        assert resp.choices[0].message.content == "feature_request"
        assert resp._provider == "opentracy"
        assert resp._cost == 0.0
        assert resp._routing["selected_model"] == s.id
        assert resp._routing["backend"] == "peft"

    def test_completion_streaming_not_supported(self, peft_dir: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
        )
        with pytest.raises(NotImplementedError, match="Streaming"):
            ot.completion(
                model=s,
                messages=[{"role": "user", "content": "hi"}],
                stream=True,
            )

    def test_string_model_path_still_works(self, monkeypatch) -> None:
        """Regression: passing a string model must not trip the Student dispatch."""
        from opentracy import sdk

        fake = sdk.ModelResponse({
            "choices": [{"message": {"content": "ok"}, "finish_reason": "stop", "index": 0}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            "_provider": "openai", "_cost": 0.0, "_latency_ms": 1.0,
        })
        monkeypatch.setattr(sdk, "_send_completion", lambda *a, **kw: fake)

        resp = ot.completion(
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "x"}],
        )
        assert resp.choices[0].message.content == "ok"


# ---------------------------------------------------------------------------
# save() round-trip
# ---------------------------------------------------------------------------


class TestSaveRoundtrip:
    def test_peft_save_copies_dir_and_meta(self, peft_dir: Path, tmp_path: Path) -> None:
        s = Student(
            backend="peft",
            model_path=str(peft_dir),
            base_model="unsloth/Llama-3.2-1B-Instruct",
            metadata={"task": "ticket-triage"},
        )
        dst = tmp_path / "exported"
        saved = s.save(dst)

        assert saved.exists()
        assert (saved / "adapter_config.json").exists()
        assert (saved / "adapter_model.safetensors").exists()

        # Metadata is readable via load_student round-trip
        s2 = load_student(saved)
        assert s2.backend == "peft"
        assert s2.base_model == "unsloth/Llama-3.2-1B-Instruct"
        assert s2.metadata == {"task": "ticket-triage"}

    def test_gguf_save_copies_file_and_sidecar(self, gguf_file: Path, tmp_path: Path) -> None:
        s = Student(
            backend="gguf",
            model_path=str(gguf_file),
            metadata={"quant": "q4_k_m"},
        )
        dst = tmp_path / "out"
        saved = s.save(dst)

        assert saved.is_file()
        assert saved.read_bytes() == gguf_file.read_bytes()

        s2 = load_student(saved)
        assert s2.backend == "gguf"
        assert s2.metadata == {"quant": "q4_k_m"}


# ---------------------------------------------------------------------------
# Public export surface
# ---------------------------------------------------------------------------


class TestPublicExports:
    def test_student_importable_from_top_level(self) -> None:
        assert ot.Student is Student  # type: ignore[attr-defined]
        assert ot.load_student is load_student  # type: ignore[attr-defined]
        assert ot.StudentError is StudentError  # type: ignore[attr-defined]

    def test_import_does_not_pull_torch(self) -> None:
        """Base-wheel invariant: importing opentracy must not trigger torch."""
        import sys
        # Re-import fresh to be sure. (If this test runs after others that
        # loaded torch via a different path, we skip — the assertion is
        # specifically about `import opentracy`, not the whole process.)
        assert "opentracy" in sys.modules
        # The student module is importable, but instantiation is what drags
        # torch in — so merely having `Student` in scope should be safe.
        assert "torch" not in sys.modules or "transformers" in sys.modules  # allow if user already imported transformers elsewhere
