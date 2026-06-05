from types import SimpleNamespace

from harness.wakeup.runner import _extract_proposed_lesson


def test_text_fallback_does_not_mislabel_unknown_tool_as_router():
    result = SimpleNamespace(
        tool_calls=[],
        response="Created lesson L-20260511-201500-abcd somehow.",
    )
    target, lesson_id = _extract_proposed_lesson(result)
    assert lesson_id == "L-20260511-201500-abcd"
    assert target == "unknown"


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
