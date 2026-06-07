from types import SimpleNamespace

from experiments.types import Mutation
from harness.approver.policy import ApprovalDecision, Policy, decide
from harness.types import LoopOutcome, Proposal


def _outcome(delta):
    proposal = Proposal(mutations=[Mutation(file="pipeline/x.yaml", path="k", value=1)])
    return LoopOutcome(
        proposal=proposal,
        candidate_id="cand-1",
        candidate_result=SimpleNamespace(delta=delta),
        final="approved",
    )


def test_decide_auto_approves_on_sufficient_lift():
    pol = Policy(mode="auto", auto_min_lift=0.01)
    assert decide(_outcome({"overall_score": 0.2}), pol) == ApprovalDecision.AUTO_APPROVE


def test_decide_auto_missing_overall_score_queues_human():
    # A degenerate delta without overall_score must degrade to human review,
    # not raise KeyError inside the approver.
    pol = Policy(mode="auto", auto_min_lift=0.01)
    assert decide(_outcome({}), pol) == ApprovalDecision.QUEUE_HUMAN
