from types import SimpleNamespace

from harness.wakeup.runner import _extract_proposed_lesson


def test_text_fallback_infers_router_by_default():
    # No router/dataset hints → conservative router default (never "unknown").
    result = SimpleNamespace(
        tool_calls=[],
        response="Created lesson L-20260511-201500-abcd somehow.",
    )
    target, lesson_id = _extract_proposed_lesson(result)
    assert lesson_id == "L-20260511-201500-abcd"
    assert target == "router"


def test_text_fallback_infers_dataset_from_keywords():
    result = SimpleNamespace(
        tool_calls=[],
        response="Ran a dataset curation cycle; lesson L-20260511-201500-abcd queued.",
    )
    target, lesson_id = _extract_proposed_lesson(result)
    assert target == "dataset"
    assert lesson_id == "L-20260511-201500-abcd"


def test_text_fallback_infers_router_from_keywords():
    result = SimpleNamespace(
        tool_calls=[],
        response="Retrained the router. Lesson L-20260511-201500-abcd.",
    )
    target, _ = _extract_proposed_lesson(result)
    assert target == "router"


def test_returns_none_when_no_lesson_id():
    result = SimpleNamespace(tool_calls=[], response="Nothing to do this round.")
    assert _extract_proposed_lesson(result) is None


def test_known_tool_call_maps_to_target():
    call = SimpleNamespace(
        tool="propose_dataset_curation",
        output_preview='{"lesson_id": "L-20260511-201500-abcd"}',
    )
    result = SimpleNamespace(tool_calls=[call], response="")
    target, lesson_id = _extract_proposed_lesson(result)
    assert target == "dataset"
    assert lesson_id == "L-20260511-201500-abcd"


def test_lesson_id_recovered_from_long_preview():
    # A long `reason` before the lesson_id must still be recoverable (the SDK
    # path widens the proposer preview cap so the id isn't truncated away).
    preview = str(
        {"action": "rejected", "reason": "x" * 400,
         "lesson_id": "L-20260511-201500-abcd"}
    )
    call = SimpleNamespace(tool="propose_router_retrain", output_preview=preview)
    result = SimpleNamespace(tool_calls=[call], response="")
    target, lesson_id = _extract_proposed_lesson(result)
    assert target == "router"
    assert lesson_id == "L-20260511-201500-abcd"
