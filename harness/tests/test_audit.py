from types import SimpleNamespace

from harness.observability.audit import aggregate_stage_ms, performance_audit


def test_aggregate_stage_ms_sums_by_name():
    stages = [
        {"stage": "retrieve", "duration_ms": 10.0},
        {"stage": "generate", "duration_ms": 100.0},
        {"stage": "retrieve", "duration_ms": 5.0},
    ]
    assert aggregate_stage_ms(stages) == {"retrieve": 15.0, "generate": 100.0}


def test_aggregate_stage_ms_accepts_objects():
    stages = [SimpleNamespace(stage="generate", duration_ms=50.0)]
    assert aggregate_stage_ms(stages) == {"generate": 50.0}


def test_performance_audit_llm_bottleneck():
    a = performance_audit({"retrieve": 10.0, "rerank": 5.0, "generate": 200.0})
    assert a["llm_ms"] == 200.0
    assert a["tool_ms"] == 15.0
    assert a["total_ms"] == 215.0
    assert a["bottleneck"] == "llm"
    assert a["llm_share"] == round(200 / 215, 4)


def test_performance_audit_tool_bottleneck():
    a = performance_audit({"retrieve": 300.0, "generate": 50.0})
    assert a["bottleneck"] == "tool"


def test_performance_audit_balanced():
    assert performance_audit({"generate": 50.0, "retrieve": 50.0})["bottleneck"] == "balanced"


def test_performance_audit_empty():
    a = performance_audit({})
    assert a == {"llm_ms": 0.0, "tool_ms": 0.0, "total_ms": 0.0,
                 "bottleneck": "none", "llm_share": 0.0, "n_llm_calls": None}


def test_performance_audit_prefers_true_split_and_adds_pipeline_stages():
    # true generate split (llm 180, MCP 20) + retrieve (8) folded into tool.
    a = performance_audit(
        {"generate": 100.0, "retrieve": 8.0}, llm_ms=180.0, tool_ms=20.0, n_llm_calls=3
    )
    assert a["llm_ms"] == 180.0
    assert a["tool_ms"] == 28.0
    assert a["bottleneck"] == "llm"
    assert a["n_llm_calls"] == 3


def test_performance_audit_custom_llm_stages():
    a = performance_audit({"rerank": 100.0, "generate": 10.0}, llm_stages={"rerank"})
    assert a["llm_ms"] == 100.0
    assert a["tool_ms"] == 10.0
