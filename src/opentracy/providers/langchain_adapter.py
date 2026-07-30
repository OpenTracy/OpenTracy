"""Optional LangChain edge adapter.

LangChain is deliberately kept OUT of the core: the context layer produces a
plain system prompt + message history, and this module converts that at the
boundary for teams composing OpenTracy into LangChain/LangGraph pipelines. If
LangChain is ever dropped, only this file goes away.

Install with: pip install "opentracy[langchain]"
"""

from __future__ import annotations

from typing import Any, Sequence

from opentracy.core.context import AssembledContext


def to_langchain_messages(
    context: AssembledContext, history: Sequence[dict[str, Any]] = ()
) -> list[Any]:
    """Render an assembled context + prior turns as LangChain messages.

    `history` is a sequence of {"role": "user" | "assistant", "content": str}
    turns — the "messages happening now" layer of the context stack.
    """
    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "langchain-core is not installed; install the extra: pip install 'opentracy[langchain]'"
        ) from exc

    messages: list[Any] = [SystemMessage(content=context.system_prompt)]
    for turn in history:
        role, content = turn["role"], turn["content"]
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
        else:
            raise ValueError(f"unsupported history role: {role!r}")
    return messages
