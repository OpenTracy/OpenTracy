import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock
from pathlib import Path

from opentracy.providers.anthropic_responder import AnthropicResponder
from opentracy.tools import ToolRegistry


def text_block(text):
    b = SimpleNamespace(type="text", text=text)
    b.model_dump = lambda: {"type": "text", "text": text}
    return b


def tool_use_block(block_id, name, tool_input):
    b = SimpleNamespace(type="tool_use", id=block_id, name=name, input=tool_input)
    b.model_dump = lambda: {"type": "tool_use", "id": block_id, "name": name,
                            "input": tool_input}
    return b


def response(blocks, stop_reason, input_tokens=100, output_tokens=10):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=blocks,
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


class AgenticLoopTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.registry = ToolRegistry.with_builtins(self.root)
        self.client = MagicMock()

    def test_tool_loop_executes_and_returns_trace(self) -> None:
        # turn 1: model writes a file; turn 2: model answers
        self.client.messages.create.side_effect = [
            response([tool_use_block("t1", "write",
                                     {"path": "memory/user.md",
                                      "content": "- prefere português\n"})],
                     stop_reason="tool_use"),
            response([text_block("anotado!")], stop_reason="end_turn",
                     input_tokens=250, output_tokens=7),
        ]
        responder = AnthropicResponder(client=self.client, tools=self.registry)
        reply = responder("system", [{"role": "user", "content": "lembre disso"}])

        # the tool actually ran
        self.assertIn("prefere português", (self.root / "memory" / "user.md").read_text())
        # final text + trace with assistant tool_use and user tool_result
        self.assertEqual(reply["content"], "anotado!")
        roles = [m["role"] for m in reply["_trace"]]
        self.assertEqual(roles, ["assistant", "user"])
        result_block = reply["_trace"][1]["content"][0]
        self.assertEqual(result_block["type"], "tool_result")
        self.assertEqual(result_block["tool_use_id"], "t1")
        # tools param sent to the API; usage accumulated across steps
        kwargs = self.client.messages.create.call_args.kwargs
        self.assertTrue(any(t["name"] == "write" for t in kwargs["tools"]))
        self.assertEqual(reply["_usage"], {"input_tokens": 250, "output_tokens": 17})

    def test_tool_error_flows_back_as_is_error(self) -> None:
        self.client.messages.create.side_effect = [
            response([tool_use_block("t1", "read", {"path": "../etc/passwd"})],
                     stop_reason="tool_use"),
            response([text_block("desculpa")], stop_reason="end_turn"),
        ]
        responder = AnthropicResponder(client=self.client, tools=self.registry)
        reply = responder("s", [{"role": "user", "content": "leia"}])
        result_block = reply["_trace"][1]["content"][0]
        self.assertTrue(result_block["is_error"])
        self.assertIn("escape", result_block["content"])

    def test_step_budget_stops_runaway_loop(self) -> None:
        self.client.messages.create.return_value = response(
            [tool_use_block("t", "ls", {})], stop_reason="tool_use"
        )
        responder = AnthropicResponder(client=self.client, tools=self.registry,
                                       max_steps=3)
        reply = responder("s", [{"role": "user", "content": "loop"}])
        self.assertEqual(self.client.messages.create.call_count, 3)
        self.assertIn("step budget exhausted", reply["content"])

    def test_no_tools_behaves_like_single_shot(self) -> None:
        self.client.messages.create.return_value = response(
            [text_block("oi")], stop_reason="end_turn"
        )
        responder = AnthropicResponder(client=self.client)  # no tools
        reply = responder("s", [{"role": "user", "content": "oi"}])
        self.assertEqual(reply["content"], "oi")
        self.assertNotIn("tools", self.client.messages.create.call_args.kwargs)

    def test_gateway_persists_trace_in_session_and_sqlite(self) -> None:
        from opentracy.gateway import Gateway

        (self.root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul")

        def responder(system_prompt, messages):
            return {
                "role": "assistant",
                "content": "feito",
                "_trace": [
                    {"role": "assistant",
                     "content": [{"type": "tool_use", "id": "t1", "name": "ls",
                                  "input": {}}]},
                    {"role": "user",
                     "content": [{"type": "tool_result", "tool_use_id": "t1",
                                  "content": "soul.md"}]},
                ],
            }

        gateway = Gateway(self.root, responder=responder)
        self.addCleanup(gateway.close)
        session = gateway.open_session()
        gateway.turn("liste os arquivos", session)

        stored = [e["message"] for e in session.get_entries() if e["type"] == "message"]
        # user + tool_use + tool_result + final = 4, all mirrored to SQLite
        self.assertEqual(len(stored), 4)
        self.assertEqual(gateway.store.message_count(session.session_id), 4)
        self.assertEqual(stored[1]["content"][0]["type"], "tool_use")

    def test_structured_history_passes_through_on_next_turn(self) -> None:
        from opentracy.providers.anthropic_responder import _to_api_messages

        history = [
            {"role": "user", "content": "liste"},
            {"role": "assistant",
             "content": [{"type": "tool_use", "id": "t1", "name": "ls", "input": {}}]},
            {"role": "user",
             "content": [{"type": "tool_result", "tool_use_id": "t1", "content": "x"}]},
            {"role": "assistant", "content": "pronto"},
        ]
        converted = _to_api_messages(history)
        self.assertEqual(converted[1]["content"][0]["type"], "tool_use")  # untouched
        self.assertEqual(converted[2]["content"][0]["type"], "tool_result")


if __name__ == "__main__":
    unittest.main()
