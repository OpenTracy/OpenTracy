---
managed: runtime      # auto-updated by the memory foundation
position: 5
budget_tokens: 6000
update_policy: dedupe before write; update over duplicate; delete falsified facts
compaction: when over budget, cold facts move to memory/archive/ (one fact per file,
  indexed in memory/archive/index.md); the hottest facts stay here
---

# Memory

Auto-maintained working memory: arbitrary durable facts worth having in every
session — how the user uses the platform, frequent behaviors, recurring
workflows, and important preferences.

## Platform usage
<!-- how the user actually uses OpenTracy / Sharpi: entry points, cadence, environments -->

## Recurring workflows
<!-- multi-step patterns seen more than once; name them so they can be referenced -->

## Preferences & conventions
<!-- durable choices that are not identity (those go to user.md) and not behavioral
     authority (that goes to soul.md) -->

## Facts
<!-- everything else worth remembering; link related entries as [[slug]] -->
