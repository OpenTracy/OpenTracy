"""memory — cross-cutting memory stage (Wave E placeholder).

Right now agents declare ``cross_cutting.memory`` in their pipeline
without anything that actually reads/writes long-term memory at the
stage layer (memory is currently handled inside the per-turn agent
via the workspace's ``memory/`` dir). This module provides a no-op
implementation so the compile path doesn't warn ``unknown technique
'memory'`` and skip the stage silently.

When real per-stage memory becomes useful (e.g., a middleware-style
hook that injects recent facts into the context BEFORE the prompt
stage), it lives here.
"""
