"""prompt_strategies — real LLM call routed to Anthropic OR OpenAI (P3.1).

The ``direct`` variant loads a prompt template, renders it with the
retrieved documents + the user request, and calls whichever provider
matches the model id picked by the route stage:

  - ``claude-*`` / ``anthropic-*``  → Anthropic SDK
  - ``gpt-*`` / ``o1-*`` / ``o3-*`` → OpenAI SDK

Token usage is stashed in ``ctx.state["llm_usage"]`` so the executor
can compute exact cost instead of the char-based estimate it falls
back to.

BYOK (P3.1): the key is resolved through ``runtime.agents.secrets``:
  1) ``agents/<active_id>/secrets.env`` (operator's per-agent key)
  2) ``os.environ`` (global ``.env`` from server startup)
  3) None → offline marker, response still non-empty, tests still pass

Offline path is intact for the cold-clone case: missing key / missing
SDK package → clearly-marked response, no crash. Same shape the rest
of the pipeline expects.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Optional

from runtime.protocols import BaseTechnique, Context, Document, Stage


logger = logging.getLogger("techniques.prompt_strategies")

_DEFAULT_MODEL = "claude-haiku-4-5"
_DEFAULT_SYSTEM = (
    "You are a helpful assistant. Answer based on the provided context. "
    "If the context does not contain the answer, say so explicitly."
)


class _Direct:
    def __init__(self, knobs: dict[str, Any]) -> None:
        self.prompt_path: str = str(knobs.get("prompt", "../prompts/system.md"))
        self.max_tokens: int = int(knobs.get("max_tokens", 2048))
        self.temperature: float = float(knobs.get("temperature", 0.3))
        # P3.4 — cap on tool-use iterations to bound runaway loops.
        # The model can call tools and read results up to this many
        # times in a single /run; on the (N+1)th iteration we force
        # an end-turn by passing tool_choice=none / no tools=.
        self.max_tool_iterations: int = int(knobs.get("max_tool_iterations", 8))

    def execute(self, context: Context) -> Context:
        from runtime.agent_context import get_active
        from runtime.agents.secrets import get_secret, provider_for_model

        model = (
            context.routing.model
            if context.routing and context.routing.model
            else _DEFAULT_MODEL
        )
        system = _load_system_prompt(self.prompt_path)
        user_msg = _render_user_message(context.documents, context.request)

        provider = provider_for_model(model) or "anthropic"
        agent_id = get_active()
        api_key = get_secret(provider, agent_id=agent_id)

        if not api_key:
            context.response = (
                f"[offline] No {provider} API key set for agent {agent_id!r} — "
                f"would have called {model} with {len(context.documents)} doc(s). "
                f"Request: {context.request!r}"
            )
            return context

        # P3.4 — discover the agent's MCP tools (cached). Empty list when
        # the agent has no MCP servers configured, which keeps the loop
        # behavior identical to pre-P3.4.
        tools: list[Any] = []
        try:
            from runtime.mcp.client import list_tools_for_agent
            tools = list_tools_for_agent(agent_id)
        except Exception as e:
            logger.warning("mcp discovery failed for %s (%s); proceeding tool-free", agent_id, e)
            tools = []

        try:
            if provider == "openai":
                text, usage, tool_calls, timing = _run_openai_loop(
                    model=model,
                    system=system,
                    user=user_msg,
                    api_key=api_key,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    tools=tools,
                    agent_id=agent_id,
                    max_iterations=self.max_tool_iterations,
                )
            else:
                text, usage, tool_calls, timing = _run_anthropic_loop(
                    model=model,
                    system=system,
                    user=user_msg,
                    api_key=api_key,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    tools=tools,
                    agent_id=agent_id,
                    max_iterations=self.max_tool_iterations,
                )
        except _SdkUnavailable as e:
            logger.warning("%s SDK unavailable: %s", provider, e)
            context.response = (
                f"[offline] {provider} SDK not installed — would have called "
                f"{model}. Request: {context.request!r}"
            )
            return context
        except Exception as e:
            logger.warning("%s call failed (%s); returning error marker", provider, e)
            context.response = (
                f"[error] LLM call failed: {type(e).__name__}: {e}. "
                f"Request: {context.request!r}"
            )
            return context

        context.response = text or "(empty response)"
        if usage:
            context.state["llm_usage"] = {**usage, "model": model, "provider": provider}
        if tool_calls:
            context.state["tool_calls"] = tool_calls
        context.state["llm_ms"] = timing["llm_ms"]
        context.state["tool_ms"] = timing["tool_ms"]
        context.state["n_llm_calls"] = timing["n_llm_calls"]
        return context


class _SdkUnavailable(RuntimeError):
    """Raised when the provider's SDK isn't importable."""


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------


def _run_anthropic_loop(
    *,
    model: str,
    system: str,
    user: str,
    api_key: str,
    max_tokens: int,
    temperature: float,
    tools: list[Any],
    agent_id: str,
    max_iterations: int,
) -> tuple[str, Optional[dict], list[dict[str, Any]]]:
    """Anthropic tool-use loop. Returns (final_text, summed_usage, tool_calls).

    Each iteration:
      1. Send messages + tools to ``messages.create``
      2. If response has ``tool_use`` blocks → invoke each via MCP and
         append a ``tool_result`` message; loop.
      3. If response has only ``text`` blocks → that's the final reply.

    Stops on ``stop_reason='end_turn'`` or after ``max_iterations``.
    The tool catalog comes from runtime.mcp.client.list_tools_for_agent.
    """
    try:
        from anthropic import Anthropic
    except ImportError as e:
        raise _SdkUnavailable("anthropic") from e
    from runtime.mcp.client import call_tool as mcp_call

    client = Anthropic(api_key=api_key)
    anthropic_tools = [t.to_anthropic_tool() for t in tools] if tools else None
    messages: list[dict[str, Any]] = [{"role": "user", "content": user}]
    total_in = 0
    total_out = 0
    tool_calls: list[dict[str, Any]] = []
    final_text = ""
    llm_ms = 0.0
    tool_ms = 0.0
    n_llm_calls = 0

    for it in range(max_iterations + 1):
        # `temperature` is intentionally NOT sent: current Anthropic models
        # reject it (HTTP 400 "temperature is deprecated for this model").
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }
        # Force end-turn on the budget iteration: drop tools so the
        # model can't request another one and we end on text.
        if anthropic_tools and it < max_iterations:
            kwargs["tools"] = anthropic_tools

        _t = time.perf_counter()
        resp = client.messages.create(**kwargs)
        llm_ms += (time.perf_counter() - _t) * 1000
        n_llm_calls += 1
        usage = getattr(resp, "usage", None)
        if usage is not None:
            total_in += int(getattr(usage, "input_tokens", 0) or 0)
            total_out += int(getattr(usage, "output_tokens", 0) or 0)

        text_parts: list[str] = []
        tool_use_blocks: list[Any] = []
        for block in (resp.content or []):
            btype = getattr(block, "type", None)
            if btype == "tool_use":
                tool_use_blocks.append(block)
                continue
            # Treat anything with a ``text`` attribute as a text block.
            # The Anthropic SDK tags blocks with type="text" but test
            # mocks + older block shapes may omit it; we accept both.
            t = getattr(block, "text", None)
            if isinstance(t, str) and t:
                text_parts.append(t)

        if not tool_use_blocks:
            final_text = "".join(text_parts)
            break

        # Append the assistant's message verbatim (per Anthropic's tool
        # protocol — the next user turn references tool_use_ids).
        messages.append({"role": "assistant", "content": resp.content})

        # Run each tool, gather tool_result blocks.
        result_blocks: list[dict[str, Any]] = []
        for tu in tool_use_blocks:
            qname = getattr(tu, "name", "")
            args = getattr(tu, "input", {}) or {}
            tu_id = getattr(tu, "id", "")
            tool_calls.append({"name": qname, "input": args, "id": tu_id})
            _t = time.perf_counter()
            try:
                result_text = mcp_call(agent_id, qname, args)
                is_error = False
            except Exception as e:
                logger.warning("mcp tool %s failed: %s", qname, e)
                result_text = f"Tool error: {type(e).__name__}: {e}"
                is_error = True
            tool_ms += (time.perf_counter() - _t) * 1000
            block: dict[str, Any] = {
                "type": "tool_result",
                "tool_use_id": tu_id,
                "content": result_text,
            }
            if is_error:
                block["is_error"] = True
            result_blocks.append(block)

        messages.append({"role": "user", "content": result_blocks})

    usage_dict: Optional[dict] = None
    if total_in or total_out:
        usage_dict = {"input_tokens": total_in, "output_tokens": total_out}
    timing = {"llm_ms": round(llm_ms, 3), "tool_ms": round(tool_ms, 3), "n_llm_calls": n_llm_calls}
    return final_text, usage_dict, tool_calls, timing


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------


def _run_openai_loop(
    *,
    model: str,
    system: str,
    user: str,
    api_key: str,
    max_tokens: int,
    temperature: float,
    tools: list[Any],
    agent_id: str,
    max_iterations: int,
) -> tuple[str, Optional[dict], list[dict[str, Any]]]:
    """OpenAI tool-use loop. Returns (final_text, summed_usage, tool_calls).

    Mirrors the Anthropic loop but uses the function-calling shape:
    response has ``tool_calls`` on choices[0].message; we append the
    assistant message + tool messages with matching ``tool_call_id``.
    """
    try:
        from openai import OpenAI
    except ImportError as e:
        raise _SdkUnavailable("openai") from e
    from runtime.mcp.client import call_tool as mcp_call

    client = OpenAI(api_key=api_key)
    openai_tools = [t.to_openai_tool() for t in tools] if tools else None
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    total_in = 0
    total_out = 0
    tool_calls: list[dict[str, Any]] = []
    final_text = ""
    llm_ms = 0.0
    tool_ms = 0.0
    n_llm_calls = 0

    for it in range(max_iterations + 1):
        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }
        if openai_tools and it < max_iterations:
            kwargs["tools"] = openai_tools

        _t = time.perf_counter()
        resp = client.chat.completions.create(**kwargs)
        llm_ms += (time.perf_counter() - _t) * 1000
        n_llm_calls += 1
        usage_obj = getattr(resp, "usage", None)
        if usage_obj is not None:
            total_in += int(getattr(usage_obj, "prompt_tokens", 0) or 0)
            total_out += int(getattr(usage_obj, "completion_tokens", 0) or 0)

        if not resp.choices:
            break
        choice = resp.choices[0]
        msg = choice.message

        # OpenAI's tool_calls may be None or empty list.
        calls = getattr(msg, "tool_calls", None) or []
        if not calls:
            final_text = msg.content or ""
            break

        # Append the assistant's tool-call message so subsequent tool
        # results can reference its tool_call ids.
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in calls
            ],
        })

        for tc in calls:
            qname = tc.function.name
            try:
                import json as _json
                args = _json.loads(tc.function.arguments) if tc.function.arguments else {}
            except Exception:
                args = {}
            tool_calls.append({"name": qname, "input": args, "id": tc.id})
            _t = time.perf_counter()
            try:
                result_text = mcp_call(agent_id, qname, args)
            except Exception as e:
                logger.warning("mcp tool %s failed: %s", qname, e)
                result_text = f"Tool error: {type(e).__name__}: {e}"
            tool_ms += (time.perf_counter() - _t) * 1000
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_text,
            })

    usage_dict: Optional[dict] = None
    if total_in or total_out:
        usage_dict = {"input_tokens": total_in, "output_tokens": total_out}
    timing = {"llm_ms": round(llm_ms, 3), "tool_ms": round(tool_ms, 3), "n_llm_calls": n_llm_calls}
    return final_text, usage_dict, tool_calls, timing


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_system_prompt(path: str) -> str:
    """Resolve the prompt path against a few likely roots; fall back to default."""
    candidates = [
        Path(path),
        Path("agent/pipeline") / path,
        Path("agent") / path,
        Path.cwd() / path,
    ]
    for p in candidates:
        try:
            resolved = p.resolve()
            if resolved.is_file():
                return resolved.read_text(encoding="utf-8").strip()
        except OSError:
            continue
    return _DEFAULT_SYSTEM


def _render_user_message(documents: list[Document], request: str) -> str:
    if not documents:
        return request
    blocks = []
    for i, doc in enumerate(documents, 1):
        blocks.append(f"[{i}] {doc.content}")
    context_str = "\n\n".join(blocks)
    return f"Context:\n{context_str}\n\nQuestion: {request}"


class _ClaudeCode:
    """``claude_code`` variant — each turn runs in an E2B sandbox via the
    Claude Code CLI, with the agent's workspace mounted so the per-turn
    agent can read its own NexAU components (skills, memory, tools).

    Distinct from ``_Direct`` (single ``messages.create`` round trip):
    here the model gets a real shell + filesystem and can edit its own
    memory/plan between turns. BYOK is mandatory — no offline marker;
    if the per-agent Anthropic key isn't set we raise so the operator
    sees the failure instead of getting a phantom response.

    See [[project_p16_4_ahe_shipped]] for the original strategy design
    (P16.4 autonomous arm). Knobs:

      - ``timeout``: sandbox lifetime, default 300s. The per-turn agent
        usually finishes well under this; longer iterations belong in
        the evolution loop, not a single chat turn.
      - ``model``: routed via context.routing if absent.
    """

    def __init__(self, knobs: dict[str, Any]) -> None:
        self.timeout_s: int = int(knobs.get("timeout", 300))

    def execute(self, context: Context) -> Context:
        from runtime.agent_context import get_active
        from runtime.agents.secrets import get_secret
        from runtime.sandbox import SandboxRun
        from runtime.workspaces import get_workspace

        agent_id = get_active()
        api_key = get_secret("anthropic", agent_id=agent_id)
        if not api_key:
            # AHE invariant per [[byok_strict]]: never fall back to a
            # platform-level key. Generate must fail closed.
            raise RuntimeError(
                f"claude_code: no Anthropic BYOK for agent {agent_id!r} — "
                "set the per-agent key before chatting"
            )

        workspace = get_workspace(agent_id)
        workspace.ensure()
        system_prompt = workspace.read_system_prompt()
        tar_in = workspace.to_tar_bytes()

        model = (
            context.routing.model
            if context.routing and context.routing.model
            else _DEFAULT_MODEL
        )

        response_chunks: list[str] = []
        try:
            with SandboxRun(
                anthropic_key=api_key,
                timeout_s=self.timeout_s,
            ) as sb:
                sb.upload_workspace_tar(tar_in)
                for evt in sb.run_claude(
                    context.request,
                    system=system_prompt,
                    model=model,
                ):
                    kind = evt.get("type")
                    if kind == "stdout":
                        response_chunks.append(evt.get("data") or "")
                    elif kind == "stderr":
                        logger.info(
                            "claude_code stderr: %s", evt.get("data"),
                        )
                    elif kind == "error":
                        logger.warning(
                            "claude_code sandbox error: %s",
                            evt.get("detail"),
                        )
                        break
                    elif kind == "done":
                        break

                # Snapshot back: the per-turn agent may have updated
                # memory/plan or skills based on the turn. Failures
                # here are logged but not fatal — the response itself
                # is the contract; workspace evolution is best-effort.
                try:
                    tar_out = sb.snapshot_workspace_tar()
                    workspace.from_tar_bytes(tar_out)
                except Exception as exc:
                    logger.warning(
                        "claude_code: snapshot back failed: %s", exc,
                    )
        except Exception as exc:
            logger.warning("claude_code: sandbox lifetime failed: %s", exc, exc_info=True)
            raise

        context.response = "".join(response_chunks).strip()
        return context


class PromptStrategiesTechnique(BaseTechnique):
    name = "prompt_strategies"
    variants = ("direct", "claude_code")

    def compile(self, variant: str, knobs: dict[str, Any]) -> Stage:
        if variant not in self.variants:
            raise ValueError(
                f"prompt_strategies: unknown variant {variant!r}; expected one of {self.variants}"
            )
        if variant == "claude_code":
            return _ClaudeCode(knobs)
        return _Direct(knobs)
