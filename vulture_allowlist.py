# Vulture allowlist: symbols vulture flags as unused but which have real callers
# it can't see (lazy/late imports, decorator registration, asdict serialization,
# registry dispatch). Pass alongside the target when scanning:
#
#     vulture harness/ vulture_allowlist.py --min-confidence 60
#
# Each reference below marks the name as used so vulture stops reporting it.

# Executor surface called from runtime/server.py UI endpoints via lazy imports.
promote_queued
requeue
reject_queued
record_manual_change
record_manual_router_change
record_manual_dataset_change

# MCP server callbacks registered via @server.list_tools()/@server.call_tool().
_list_tools
_call_tool

# Wakeup scheduler fire, called from runtime/executor/tracing.py.
maybe_fire

# Brain transport completion, used as the LLMJudge backend in router/augmentation.
complete

# Onboarding completion endpoint in runtime/server.py.
record_complete

# Critics reachable only through the @register_critic registry (make_critic).
NoCriticalRegression
PredictionHonestyCritic

# DistilledSession / DistilledEpoch fields are emitted via dataclasses.asdict().
blocking_critic
proposal_source
trace_ids
avg_overall_score
avg_delta_when_promoted
