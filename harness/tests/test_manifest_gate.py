from experiments.types import Mutation
from harness.critics import make_critic
from harness.types import CriticContext, ManifestVerdict, Prediction, Proposal


def _ctx(manifest_verdict):
    return CriticContext(
        proposal=Proposal(mutations=[Mutation(file="pipeline/x.yaml", path="k", value=1)]),
        manifest_verdict=manifest_verdict,
    )


def _verdict(fixes, fixed, regressed):
    return ManifestVerdict.evaluate(
        Prediction(rubric="overall", expected_delta=0.1, rationale="x",
                   predicted_fixes=frozenset(fixes)),
        {"fixed": list(fixed), "regressed": list(regressed), "unchanged": []},
    )


def test_manifest_gate_blocks_rollback_and_pivot():
    mv = _verdict(["g1"], ["g1"], ["g9"])  # unpredicted regression -> ROLLBACK_AND_PIVOT
    v = make_critic("manifest_gate").verdict(_ctx(mv))
    assert not v.approved
    assert v.severity == "block"


def test_manifest_gate_passes_keep():
    mv = _verdict(["g1"], ["g1"], [])  # KEEP
    assert make_critic("manifest_gate").verdict(_ctx(mv)).approved


def test_manifest_gate_passes_without_verdict():
    assert make_critic("manifest_gate").verdict(_ctx(None)).approved
