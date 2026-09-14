"""The real Responder: Claude via the official Anthropic SDK.

Drops into the Gateway's Responder seam (ADR-0006). Credentials resolve the
SDK's standard way — ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
`ant auth login` profile; nothing is hardcoded here.

Message handling notes:
- The session tree emits mid-history {"role": "system"} messages (compaction
  and branch summaries, ADR-0005). Mid-conversation system messages are only
  supported on some models, so for portability they are converted to user
  messages wrapped in <system-reminder> tags — the documented fallback.
- Returns the assistant message plus a "_usage" side-channel key the Gateway
  strips and feeds to the ContextCompressor (ADR-0002 token accounting).
"""

from __future__ import annotations

import json
from typing import Any

Message = dict[str, Any]

DEFAULT_MODEL = "claude-opus-4-8"
DEFAULT_MAX_TOKENS = 16_000
DEFAULT_MAX_STEPS = 24


class AnthropicResponder:
    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        client: Any = None,
        tools: Any = None,  # ToolRegistry-compatible: to_api() + execute()
        max_steps: int = DEFAULT_MAX_STEPS,
    ):
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        self.client = client
        self.model = model
        self.max_tokens = max_tokens
        self.tools = tools
        self.max_steps = max_steps

    def __call__(self, system_prompt: str, messages: list[Message]) -> Message:
        """The agentic loop: model call → execute tool_use blocks → feed
        tool_results back → repeat until end_turn or the step budget runs out.
        Intermediate turns come back in "_trace" so the Gateway persists the
        full exchange in the session tree."""
        api_messages = _to_api_messages(messages)
        trace: list[Message] = []
        output_tokens = 0
        response = None

        for _step in range(self.max_steps):
            kwargs: dict[str, Any] = dict(
                model=self.model,
                max_tokens=self.max_tokens,
                thinking={"type": "adaptive"},
                system=system_prompt,
                messages=api_messages,
            )
            if self.tools is not None:
                kwargs["tools"] = self.tools.to_api()
            response = self.client.messages.create(**kwargs)
            output_tokens += response.usage.output_tokens

            if response.stop_reason == "pause_turn":
                api_messages.append(
                    {"role": "assistant", "content": _dump_content(response)}
                )
                continue

            if response.stop_reason != "tool_use" or self.tools is None:
                break

            # record the assistant turn (thinking + tool_use blocks) verbatim
            assistant_msg = {"role": "assistant", "content": _dump_content(response)}
            api_messages.append(assistant_msg)
            trace.append(assistant_msg)

            results = []
            for block in response.content:
                if block.type == "tool_use":
                    output, is_error = self.tools.execute(block.name, block.input)
                    result: Message = {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": output,
                    }
                    if is_error:
                        result["is_error"] = True
                    results.append(result)
            result_msg = {"role": "user", "content": results}
            api_messages.append(result_msg)
            trace.append(result_msg)

        if response is None:
            raise RuntimeError("responder made no API call")
        if response.stop_reason == "refusal":
            text = "[OpenTracy] The model declined this request for safety reasons."
        elif response.stop_reason == "tool_use":
            text = "[OpenTracy] step budget exhausted mid-task — ask me to continue."
        else:
            text = "".join(
                block.text for block in response.content if block.type == "text"
            )

        return {
            "role": "assistant",
            "content": text,
            "_trace": trace,
            "_usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": output_tokens,
            },
        }


def _dump_content(response: Any) -> list[dict[str, Any]]:
    """SDK content blocks → plain dicts (lossless: thinking signatures and
    tool_use ids survive for replay and for the session record)."""
    return [block.model_dump() for block in response.content]


def _to_api_messages(messages: list[Message]) -> list[Message]:
    """Session-context messages → Messages API shape.

    - mid-history system messages → user messages in <system-reminder> tags
    - structured block lists (tool_use / tool_result / thinking from earlier
      turns) pass through untouched — they replay verbatim
    - other non-string content is serialized defensively
    """
    api_messages: list[Message] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if isinstance(content, list):
            if role in ("user", "assistant"):
                api_messages.append({"role": role, "content": content})
                continue
            content = json.dumps(content, ensure_ascii=False)
        elif not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False)
        if role == "system":
            role = "user"
            content = f"<system-reminder>\n{content}\n</system-reminder>"
        if role not in ("user", "assistant"):
            role = "user"
        api_messages.append({"role": role, "content": content})
    if not api_messages or api_messages[0]["role"] != "user":
        api_messages.insert(0, {"role": "user", "content": "(session start)"})
    return api_messages


def credentials_available() -> bool:
    """Best-effort check whether the SDK can resolve any credential source."""
    import os
    from pathlib import Path

    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    config_dir = Path(
        os.environ.get("ANTHROPIC_CONFIG_DIR", Path.home() / ".config" / "anthropic")
    )
    return (config_dir / "credentials").exists()
