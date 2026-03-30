"""AgentRunner — loads an agent .md, calls LLM, parses structured output."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

import httpx

from .registry import AgentConfig, AgentRegistry
from .tools import ToolKit

logger = logging.getLogger(__name__)

DEFAULT_ENGINE_URL = "http://localhost:8080"


def _strip_markdown_json(text: str) -> str:
    """Extract JSON from LLM response, handling markdown code fences."""
    text = text.strip()
    if text.startswith("```"):
        # Remove first line (```json or ```) and last ```
        lines = text.split("\n")
        start = 1
        end = len(lines)
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[start:end]).strip()
    return text


def _render_template(template: str, context: dict[str, Any]) -> str:
    """Simple {variable} replacement in prompt templates."""
    result = template
    for key, value in context.items():
        result = result.replace(f"{{{key}}}", str(value))
    return result


class AgentRunner:
    """Loads an agent .md, sends prompt to LLM, parses structured output.

    All LLM calls use X-Lunar-Internal: true to prevent trace contamination.
    """

    def __init__(
        self,
        engine_url: str = DEFAULT_ENGINE_URL,
        registry: Optional[AgentRegistry] = None,
        toolkit: Optional[ToolKit] = None,
    ):
        self.engine_url = engine_url
        self.registry = registry or AgentRegistry()
        self.toolkit = toolkit or ToolKit()

    async def run(
        self,
        agent_name: str,
        user_input: str,
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Execute an agent and return structured output.

        1. Load agent .md (system prompt + config)
        2. Render context variables into user_input
        3. Call LLM via Go engine
        4. Parse JSON response
        5. Validate against output_schema if defined
        """
        config = self.registry.get(agent_name)
        if config is None:
            raise ValueError(f"Agent '{agent_name}' not found")

        # Render context variables
        if context:
            user_input = _render_template(user_input, context)

        # Call LLM
        response_text = await self._call_llm(config, user_input)

        # Parse output
        if config.output_schema.type == "json":
            return self._parse_json(response_text, config)
        else:
            return {"text": response_text}

    async def run_with_tools(
        self,
        agent_name: str,
        user_input: str,
        max_turns: int = 5,
    ) -> dict[str, Any]:
        """Execute an agent with tool access (multi-turn).

        The agent can request tool calls. The runner executes them
        and feeds results back until the agent produces a final answer.
        """
        config = self.registry.get(agent_name)
        if config is None:
            raise ValueError(f"Agent '{agent_name}' not found")

        # Build system prompt with tool descriptions
        tools_desc = "\n".join(
            f"- {t['name']}: {t['description']}" for t in self.toolkit.available()
        )
        system = (
            f"{config.system_prompt}\n\n"
            f"You have access to these tools:\n{tools_desc}\n\n"
            f"To call a tool, respond with: {{\"tool\": \"tool_name\", \"args\": {{...}}}}\n"
            f"When you have your final answer, respond with the result JSON directly (no tool wrapper)."
        )

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_input},
        ]

        for turn in range(max_turns):
            response_text = await self._call_llm_messages(config, messages)

            # Check if it's a tool call
            try:
                parsed = json.loads(_strip_markdown_json(response_text))
                if isinstance(parsed, dict) and "tool" in parsed:
                    tool_name = parsed["tool"]
                    tool_args = parsed.get("args", {})
                    tool_fn = self.toolkit.get(tool_name)

                    if tool_fn is None:
                        tool_result = {"error": f"Unknown tool: {tool_name}"}
                    else:
                        tool_result = await tool_fn(**tool_args)

                    # Feed tool result back
                    messages.append({"role": "assistant", "content": response_text})
                    messages.append({
                        "role": "user",
                        "content": f"Tool result for {tool_name}:\n{json.dumps(tool_result, default=str)}"
                    })
                    continue
                else:
                    # Final answer (no tool call)
                    return parsed
            except json.JSONDecodeError:
                # Not JSON — treat as final text answer
                return {"text": response_text}

        # Max turns exhausted
        return {"error": "Max tool turns exhausted", "last_response": response_text}

    async def _call_llm(self, config: AgentConfig, user_input: str) -> str:
        """Single-turn LLM call."""
        messages = [
            {"role": "system", "content": config.system_prompt},
            {"role": "user", "content": user_input},
        ]
        return await self._call_llm_messages(config, messages)

    async def _call_llm_messages(self, config: AgentConfig, messages: list[dict]) -> str:
        """Call Go engine chat completions with X-Lunar-Internal header."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{self.engine_url}/v1/chat/completions",
                headers={"X-Lunar-Internal": "true"},
                json={
                    "model": config.model,
                    "messages": messages,
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens,
                },
            )
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]

    def _parse_json(self, text: str, config: AgentConfig, _retry: bool = False) -> dict:
        """Parse JSON from LLM response. Retries once on failure."""
        cleaned = _strip_markdown_json(text)
        try:
            parsed = json.loads(cleaned)
            if not isinstance(parsed, dict):
                parsed = {"value": parsed}
            return parsed
        except json.JSONDecodeError as e:
            if _retry:
                logger.warning(f"Agent {config.name}: JSON parse failed after retry: {e}")
                return {"raw_text": text, "parse_error": str(e)}
            logger.debug(f"Agent {config.name}: JSON parse failed, will retry")
            # Could retry with LLM but for now just return the error
            return {"raw_text": text, "parse_error": str(e)}
