# harness/

**The optimizer that improves the agent.**

Everything under `agent/` is a *trainable surface* — a YAML file plus a handful
of Python files describing how the bot retrieves, routes, remembers, and
answers. The harness is the machine that edits that surface and keeps it
honest. Given evidence from real traces, it:

1. **proposes** a candidate edit,
2. **critiques** it (before *and* after running it),
3. **scores** it on an eval suite,
4. **promotes** the winners to live — or **rolls back** the losers,

and records a *falsifiable prediction* plus a *per-edit verdict* for every
change, so the loop's own judgement stays auditable round over round.

## The one mental model to keep

> A proposal travels through **one uniform pipeline** —
> **proposer → critic → approver → executor → ledger** — no matter who proposed
> it (a heuristic sweep, the introspection "brain", or a human) or what it
> touches (a pipeline knob, the router, a dataset).

The harness is deliberately a *seam*, not a monolith. Each subpackage owns one
stage of that pipeline and nothing else. If you learn where the seam is, the
rest of the module falls into place.

## Where to start reading

| If you want to… | Read this |
|---|---|
| see the whole flow in one file | `loop.py` — `propose_and_score()` then `run_loop()` |
| understand the data passed between stages | `types.py` + [Key data types](#key-data-types) below |
| run it yourself | [CLI usage](#cli-usage) (`python -m harness sweep`) |
| change *what the loop does* | `policies/blueprint.yaml` |
| change *whether a change ships* | `policies/auto_approve.yaml` |

---

## The loop

`harness/loop.py` is the orchestration seam. It has two entry points:

- **`propose_and_score()`** runs stages **1–5**: it takes raw proposals and
  returns scored, critic-judged outcomes. No live change happens here.
- **`run_loop()`** wraps that with stages **6–8**: it asks the approver whether
  each outcome may ship, optionally promotes the winner, and writes the audit
  trail.

```
        proposer/  produces a Proposal
        (+ optional Prediction / Change Manifest)
                       │
   ┌───────────────────┴─── propose_and_score() ────────────────────┐
   │                                                                 │
   │  1. PRE critics      sees the Proposal ONLY. Cheap.             │
   │     critics/ @ PRE   block? ─► rejected, stop (never branched)  │
   │            │                                                    │
   │            ▼                                                    │
   │  2. branch           copy agent/ into a throwaway candidate     │
   │     experiments/     ─► experiments/candidates/<id>/            │
   │            │                                                    │
   │            ▼                                                    │
   │  3. score            run the eval suite on the candidate        │
   │     experiments/     ─► pass-rate · quality · per-golden · ms   │
   │            │                                                    │
   │            ▼                                                    │
   │  4. verify           did reality match the prediction?          │
   │     types.py         per-golden ─► ManifestVerdict              │
   │            │         rubric     ─► VerificationOutcome          │
   │            ▼                                                    │
   │  5. POST critics     sees the scored candidate + verdict        │
   │     critics/ @ POST  block? ─► rejected   else ─► approved      │
   │            │                                                    │
   └────────────┼────────────────── run_loop() ─────────────────────┘
                ▼
      6. decide            approver/policy.py
         approver/         AUTO_APPROVE · QUEUE_HUMAN · REJECT
                │          (per-kind override ─► global mode)
                ▼
      7. execute           executor/promote.py
         executor/         AUTO_APPROVE + auto_promote ─► promote()
                │                                  (atomic swap + version++)
                │          QUEUE_HUMAN ─► review-queue entry, no live change
                │          REJECT      ─► no live change
                ▼
      8. record            ledger/  +  observability/
         ledger/           LedgerEntry + Lesson + distilled session
```

The same eight stages, with the exact module and what each emits:

| Stage | Module | What it does |
|---|---|---|
| 1. PRE critics | `critics/` (`CriticStage.PRE`) | Cheap checks on the bare `Proposal`, *before* any work. A `block` here rejects it without branching. |
| 2. branch | `experiments/branching.py:create_candidate` | Materializes a throwaway candidate agent tree at `experiments/candidates/<id>/`. |
| 3. score | `experiments/runner.py:run_candidate` | Returns a `CandidateResult` with `delta` (overall, per-golden, per-rubric) and timings. |
| 4. verify | `types.py` (`ManifestVerdict`, `VerificationOutcome`) | Only runs if the proposal carried a `Prediction`. Per-golden sets vs. a rubric scalar are mutually exclusive. |
| 5. POST critics | `critics/` (`CriticStage.POST`) | Sees the scored candidate + manifest verdict. The quality gate. |
| 6. decide | `approver/policy.py:decide` | Applies `policies/auto_approve.yaml`. Conservative default: *review*. |
| 7. execute | `executor/promote.py`, `rollback/rollback.py` | Atomic, snapshot-first promotion; per-file rollback. |
| 8. record | `ledger/`, `observability/distillation.py` | Append-only audit + Lesson cards + distilled sessions. |

**`promote_strategy`** controls how many `AUTO_APPROVE` outcomes actually
promote in a batch:

- `"best"` *(default)* — only the single highest-scoring outcome (ranked by the
  blueprint's selection key),
- `"all"` — every eligible outcome, sequentially,
- `"none"` — records only, never promotes.

---

## Package structure

Read this top-to-bottom and it traces the same path a proposal takes through the
loop. Each subpackage is one stage of the seam.

### The pipeline stages

**`proposer/`** — *Where edits are born.* Generates `Proposal`s and, optionally,
their Change-Manifest predictions. Today the workhorse is `sweep_knob` (a
heuristic that mutates one knob over a list of values); `predict_impact` attaches
a falsifiable prediction; `RouterProposer` and `DatasetProposer` handle the
router-config and dataset-curation paths.

**`critics/`** — *The gate.* A registry of named checks that approve or block a
proposal. Each is a `Critic` subclass with a `stage` (PRE/POST), registered via
`@register_critic` and instantiated by name with `make_critic`. Built-ins live
in `critics/builtins.py`; router/dataset have their own gates. See
[Critics](#critics).

**`approver/`** — *The policy gate between "the critics liked it" and "it goes
live".* `decide()` reads `policies/auto_approve.yaml` and returns
`AUTO_APPROVE` / `QUEUE_HUMAN` / `REJECT`. Also home to `AutoRollback`
thresholds. The conservative default is to queue for a human.

**`executor/`** — *The only code that touches the live surface.* `promote`
performs an atomic, snapshot-first swap and bumps the version. Variants cover
the queued-human path (`promote_queued`), the router and dataset paths
(`promote_router_config`, `promote_dataset`), and recording manual actions.

**`rollback/`** — *The undo.* `rollback_to` restores the whole `agent/` tree
from a prior snapshot; `rollback_edits` does file-granularity undo of a single
bad edit.

**`ledger/`** *(repo root, not under `harness/`)* — *The append-only record.*
Every stage-8 write lands here. The introspection tools read it back.

### The decision config

**`blueprint.py`** — *What the loop does, as one versioned object.* Which
critics run, the selection key, the promote strategy, which stages count as LLM
time. Loaded from `policies/blueprint.yaml`. Treating the loop's own config as
an editable artifact is "meta-evolution" (see [Grounding](#grounding-in-the-literature)).

### Observability & self-knowledge

**`observability/`** — *The three pillars made queryable.* `performance_audit`
(component pillar — LLM-vs-tool time), `distill_*` (experience pillar — folds
raw artifacts into structured sessions/epochs), and the decision pillar (the
ledger payloads). See [Observability](#observability).

**`introspection/`** — *How the "brain" reads the harness's own history.* An MCP
surface (`lib.py` pure functions, `tools.py` schema, `agent.py:introspect`) so a
proposing agent can study past promotions, rollbacks, and predictions before
suggesting the next change. Used by both Claude Code (dev) and the runtime UI
(prod).

**`brain/`** — *Tool-free LLM transport.* `brain/transport.py` auto-selects the
Anthropic API or the local `claude` CLI for plain completions.

### Scheduling & safety

**`wakeup/`** — *The scheduler that decides when to retrain.* A count-threshold
trigger (`maybe_fire`) that *invites* a retrain once enough new evidence has
accumulated; `run_wakeup` executes it.

**`watchers/`** — *Live-regression detection.* Pure decision logic
(`check_auto_rollback`, `RollbackDecision`) that flags a shipped change for
rollback once production telemetry says it's hurting.

### At the package root

- **`loop.py`** — orchestration (the eight stages above).
- **`types.py`** — the shared data types every stage passes around.
- **`benchmarks/`** — offline accuracy/quality benchmarks for the loop's *own*
  machinery. Not part of the live path.
- **`tests/`** — unit + end-to-end tests for the loop.

---

## Key data types

Defined in `harness/types.py` unless noted. These are what flow between the
stages above.

- **`Proposal`** — a candidate mutation set the proposer wants to test, *before*
  branching. Carries `mutations: list[Mutation]`, a `source`
  (`heuristic` / `claude_code` / `human` / …), free-form `metadata`, and an
  optional `Prediction`. No `candidate_id` yet — the loop assigns one at branch
  time.

- **`Prediction`** — a falsifiable claim. A `rubric` (a named eval rubric or the
  special `"overall"`) with a signed `expected_delta`, a `rationale`, and the
  **Change Manifest**: the sets `predicted_fixes` and `predicted_regressions`
  (frozensets of golden ids). The sign of the delta is the predicted direction;
  the manifest sets are what the verdict scores against reality.

- **`VerificationOutcome`** — did reality match a *rubric-scalar* prediction?
  Reports `direction_correct` (sign matches), `magnitude_met`
  (`|actual| ≥ |expected|`), and a `verdict` of
  `verified` / `partial` / `wrong` / `no_change`. Used for router/dataset
  proposals whose prediction is rubric-only.

- **`ManifestVerdict`** — the per-edit verdict over the Change Manifest, and the
  real contract for per-golden predictions. Tracks `fix_precision`/`fix_recall`
  and — critically — `regression_precision`/`regression_recall`, plus
  `realized_fixes`, `realized_regressions`, `unpredicted_regressions`, and
  `net_fixes`. The final `EditVerdict` separates an **honesty axis** (was there
  a *surprise*?) from a **value axis** (net positive?):

  | Condition | Verdict |
  |---|---|
  | an *unpredicted* regression appeared, **or** `net_fixes < 0` | `ROLLBACK_AND_PIVOT` |
  | `net_fixes == 0` (honest, non-negative) | `IMPROVE` |
  | predicted fixes all landed (`predicted_fixes ⊆ actual_fixes`) and `net > 0` | `KEEP` |
  | otherwise (net positive but the exact claim didn't fully hold) | `IMPROVE` |

  An *honestly-predicted* regression does **not** force a pivot — only an
  *unpredicted* one or a true net loss does. So a regressions-only prediction
  can reach at most `IMPROVE`, never `KEEP`. That's intentional.

- **`LoopOutcome`** — the final state of one proposal's round: the `proposal`,
  its `candidate_id` (if branched), the accumulated `verdicts`, the
  `candidate_result`, and whichever of `verification` / `manifest_verdict`
  applies. `final` is `approved` / `rejected` / `pending`; `.approved` is the
  property the approver consumes.

---

## Critics

Critics are the gate. Each subclasses `Critic`, sets a class-level `name` and
`stage`, implements `verdict(ctx) -> CriticVerdict`, and registers itself with
`@register_critic`. The loop instantiates them by name via
`make_critic(name, params)`. A verdict carries `approved`, a `reason`, and a
`severity` of `info` / `warn` / `block` — **only an un-approved `block`
actually stops a proposal.**

Two stages, enforced by the loop:

- **PRE** (`CriticStage.PRE`) — sees only the `Proposal` (`ctx.proposal`). Runs
  *before* branching, so a block here is cheap.
- **POST** (`CriticStage.POST`) — also sees `ctx.candidate_result` and
  `ctx.manifest_verdict`. Runs after the suite scores the candidate.

### Built-ins (`critics/builtins.py`)

| Critic | Stage | What it does | Wiring |
|---|---|---|---|
| `scope` | PRE | Every mutation file must match the `mutable` allowlist in `config/claude_code.yaml` (canonicalized so `..` can't escape). The hard boundary that stops the loop touching framework code. | **default** |
| `eval_lift` | POST | Candidate `Δoverall_score` must be ≥ `min_delta` (default `0.0` = non-regressing). The quality gate. | **default** |
| `regression_budget` | POST | Block when more goldens flipped pass→fail than `max_regressions` (default `0`) — catches the per-task break the aggregate score hides. | opt-in |
| `manifest_gate` | POST | Block when the manifest verdict is `ROLLBACK_AND_PIVOT`. Turns the manifest from advisory into enforcement. | opt-in |
| `no_critical_regression` | POST | No per-rubric score may drop below `floor` — a Goodhart guard against "won on average but tanked a key rubric". | experimental |
| `prediction_honesty` | POST | **Warns, never blocks** when a predicted fix didn't land or an *unpredicted* regression appeared — a learning signal that surfaces the loop's regression blindness. | experimental |

The default set lives in `blueprint.py` / `policies/blueprint.yaml`:
`pre: [scope]`, `post: [eval_lift]`. Opt-in critics are registered and ready —
just add them to the blueprint. The router and dataset paths carry their own
quality gates (`router_quality_gate` in `critics/router_critic.py`,
`dataset_quality_gate` in `critics/dataset_critic.py`) used by the introspection
pipelines.

---

## Configuration

Two human-authored YAML files under `policies/` drive the loop. **Neither is
ever mutated by the loop** — they're the controls *you* hold.

### `policies/blueprint.yaml` — *what the loop does* (`blueprint.py`)

The evolution blueprint, treated as one editable object. Reconfigure the loop
without code changes:

```yaml
version: 1
pre_critics:
  - scope
post_critics:
  - eval_lift
  # gate per-golden regressions:
  # - {name: regression_budget, params: {max_regressions: 1}}
  # block ROLLBACK_AND_PIVOT manifest verdicts:
  # - manifest_gate
selection: selection_key   # pass-rate → quality → −latency  (or: two_tier)
promote_strategy: best     # best | all | none
llm_stages:                # which stages count as LLM time in the perf audit
  - generate
```

A critic entry is either a bare `name` or a `{name, params}` mapping.
`selection` picks the ranking key used by `promote_strategy: best`. A missing
file falls back to built-in defaults.

### `policies/auto_approve.yaml` — *whether a change ships* (`approver/policy.py`)

```yaml
mode: review               # global default: auto | review | off
thresholds:
  auto_min_lift: 0.01      # min Δoverall for AUTO_APPROVE under mode=auto
overrides:                 # per change-kind mode override
  prompt: 'off'
  router: auto
  tool: 'off'
  policy: auto
  eval: auto
auto_rollback:             # thresholds for metric-triggered rollback
  csat_drop: 0.3           # absolute drop on a 0..5 scale
  resolution_drop: 0.05    # 5pp drop in resolution rate
  window_hours: 24
  notify_channels: [email]
```

`decide()` resolves the effective mode per change *kind* (computed from the
mutated files by `kind_from_mutations`): a per-kind override wins, else the
global `mode`. Then:

- **`off`** → `REJECT`.
- **`review`** → `QUEUE_HUMAN` (a `queued_review` ledger entry + an
  `awaiting_review` Lesson; `executor.promote_queued` finalizes it on approval).
- **`auto`** → `AUTO_APPROVE` if `Δoverall ≥ auto_min_lift`, else `QUEUE_HUMAN`.

The `auto_rollback` block is read and persisted today;
`watchers/auto_rollback.py` holds the pure decision logic
(`check_auto_rollback`) and the wakeup runner executes the rollback once
production CSAT/resolution telemetry flows.

---

## CLI usage

`python -m harness` exposes two subcommands.

### `sweep` — run the full loop over one knob

```bash
uv run python -m harness sweep \
  --knob 'pipeline/retrieve.yaml:knobs.k' \
  --values 12,18,24 \
  --suite evals/suites/smoke_v0.yaml \
  --policy-mode review
```

Generates one `Proposal` per value (each mutating `file:dotted.path` to that
value via `sweep_knob`) and drives the full
Proposal → PRE → branch → score → POST → approver pipeline, printing a per-value
table of `final`, `decision`, `Δoverall`, promoted version, and verdicts.

| Flag | Meaning |
|---|---|
| `--knob` | `file:dotted.path` of the knob to mutate, e.g. `pipeline/retrieve.yaml:knobs.k` |
| `--values` | comma-separated values (each JSON-parsed when possible) |
| `--suite` | path to the eval suite YAML to score against |
| `--pre-critics` / `--post-critics` | comma-separated critic names; default to the blueprint |
| `--policy-mode` | override `auto_approve.yaml` mode (`auto` / `review` / `off`) for this run |
| `--policy-min-lift` | min `Δoverall` for auto promotion (only under `mode=auto`) |
| `--auto-promote` | actually promote `AUTO_APPROVE` outcomes (default: off — records only) |
| `--promote-strategy` | `best` / `all` / `none` when `--auto-promote` is set (default `best`) |

### `rollback` — restore the live agent to a prior version

```bash
uv run python -m harness rollback v0.0.1
```

Whole-tree restore of `agent/` from the `v0.0.1` snapshot (validated against
`list_snapshots()`), recording a `rollback` ledger entry. No-ops if already
there. Add `--reason "…"` to annotate the entry. For file-granularity undo of a
single bad edit, call `rollback.rollback_edits(version, files)` from code.

---

## Observability

The three observability pillars, made queryable.

### Distillation (experience pillar)

`python -m harness.observability` turns raw artifacts (ledger, results,
candidates, lessons) into structured, content-addressable corpus entries under
`traces/distilled/`. Re-running over the same inputs is idempotent.

```bash
uv run python -m harness.observability sessions          # one DistilledSession per candidate
uv run python -m harness.observability day 2026-06-05    # one DistilledEpoch for a day
uv run python -m harness.observability version v0.0.2    # epoch scoped to a version
uv run python -m harness.observability all               # sessions + today + every snapshot
```

A `DistilledSession` (`observability/types.py`) folds one candidate's mutations,
suite scores, `final_decision`, promoted version, the recovered prediction +
verdict, and a `performance` block into a single record with a human-readable
`summary`.

### Performance audit (component pillar)

`observability/audit.py:performance_audit` splits a run's latency into LLM time
and tool/compute time and names the bottleneck
(`llm` / `tool` / `balanced` / `none`). It prefers the true split measured
inside the generate loop (`llm_ms` / `tool_ms` / `n_llm_calls`) and falls back
to classifying aggregated stage timings by `llm_stages` (the `generate` stage is
LLM; retrieve/rerank/route/memory are tool/compute). Returns `llm_ms`,
`tool_ms`, `total_ms`, `bottleneck`, and `llm_share`.

### The ledger (decision pillar)

Every promotion writes a `promote` `LedgerEntry` whose payload records the
decision-observability data: the `mutations`, the eval `delta`, the critic
`verdicts`, and — when present — the `prediction`, the `verification`, and the
`manifest_verdict`. The queue-for-review and human-approved paths carry the same
fields forward, so a change is auditable the same way no matter how it shipped.
The MCP introspection surface (`introspection/tools.py`) reads this back —
`list_recent_promotions`, `list_recent_rollbacks`, `list_predictions`,
`get_lesson`, `get_day_epoch`, `list_available_epochs`, plus the
`*_health_check` / `propose_*` tools — so the brain can reason over the
harness's own track record before it proposes the next change.

---

## Grounding in the literature

Two papers shape this module. We follow them where they're right and diverge
where our setting differs; the divergences are intentional and called out below.
*You don't need this section to use the harness* — it explains *why* the design
looks the way it does.

### AHE — *Agentic Harness Engineering* (arXiv 2604.25850)

AHE frames self-improvement around **three observability pillars** and one
headline failure mode:

| Pillar | What it observes | Where it lives here |
|---|---|---|
| **Component** | per-stage behavior + latency | `observability/audit.py` (LLM-vs-tool split), per-stage timings in candidate results |
| **Experience** | what happened across runs | `observability/distillation.py` → `DistilledSession` / `DistilledEpoch` |
| **Decision** | *why* a change was made and whether it paid off | the **Change Manifest** — `Prediction`, `VerificationOutcome`, `ManifestVerdict`, recorded into the ledger per promotion |

The **Change Manifest** is AHE's contract: before an edit runs, the proposer
stakes two task-name sets — `predicted_fixes` and `predicted_regressions` — and
after it runs we score reality against that claim. AHE's headline limitation is
**regression-blindness**: aggregate-score loops happily promote a change that
won on average while silently breaking individual tasks. We measure the
regression axis explicitly (`ManifestVerdict.regression_precision/recall`,
`unpredicted_regressions`) so the blind spot is visible round over round.

### *The Last Harness You'll Ever Build* (arXiv 2604.21003)

This paper contributes the **Worker / Evaluator / Evolution** split, a
**two-tier score** (pass/fail first, latency as tiebreaker), and a
**performance audit** that separates LLM-inference time from tool/environment
time to tell whether a bottleneck is computational or behavioral.

| Concept | Mapping here |
|---|---|
| Worker | the compiled `agent/` pipeline (`runtime/`) |
| Evaluator | `evals/` + `experiments/runner.py` (scores a candidate on a suite) |
| Evolution | this module — proposer, critics, approver, executor |
| Two-tier score | `evals/scoring.py:two_tier_key` (pass-rate, then −latency) |
| Performance audit | `observability/audit.py` (`generate` = LLM time; retrieve/rerank/route/memory = tool/compute) |
| Evolution blueprint as an editable object | `blueprint.py` (`policies/blueprint.yaml`) |

**Deliberate divergences:**

- **Pre-promotion branch-and-gate attribution.** The manifest verdict is
  computed *before* a change goes live, against per-golden eval deltas, so a bad
  edit can be gated at the door — not only diagnosed post-mortem from production
  telemetry.
- **A real default agent, not a minimal seed.** We start from a working agent
  surface rather than evolving from a bare seed, so proposals are edits to a
  shipping system.
- **Single rollout per golden by default.** The paper averages k≥2 rollouts for
  pass@1 stability; our default is one rollout per golden (k≥2 is available but
  not the default).
- **A quality tier on top of two-tier.** `evals/scoring.py:selection_key` adds
  `overall_score` (mean rubric score) *between* pass-rate and latency, so the
  loop never promotes a faster-but-worse answer over an equally-passing,
  higher-quality one. `selection_key` is the default; `two_tier` is the
  paper-literal alternative.
</content>
