import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from opentracy.providers.anthropic_responder import AnthropicResponder, _to_api_messages


def fake_response(text: str = "hello!", stop_reason: str = "end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="thinking", thinking=""),
                 SimpleNamespace(type="text", text=text)],
        usage=SimpleNamespace(input_tokens=1_234, output_tokens=56),
    )


class AnthropicResponderTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = MagicMock()
        self.client.messages.create.return_value = fake_response()
        self.responder = AnthropicResponder(client=self.client)

    def test_calls_api_with_system_and_adaptive_thinking(self) -> None:
        reply = self.responder("the context stack", [{"role": "user", "content": "oi"}])
        kwargs = self.client.messages.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "claude-opus-4-8")
        self.assertEqual(kwargs["system"], "the context stack")
        self.assertEqual(kwargs["thinking"], {"type": "adaptive"})
        self.assertEqual(kwargs["messages"], [{"role": "user", "content": "oi"}])
        self.assertEqual(reply["role"], "assistant")
        self.assertEqual(reply["content"], "hello!")

    def test_usage_side_channel_for_compressor(self) -> None:
        reply = self.responder("s", [{"role": "user", "content": "oi"}])
        self.assertEqual(reply["_usage"], {"input_tokens": 1_234, "output_tokens": 56})

    def test_refusal_stop_reason_is_handled(self) -> None:
        self.client.messages.create.return_value = fake_response(stop_reason="refusal")
        reply = self.responder("s", [{"role": "user", "content": "oi"}])
        self.assertIn("declined", reply["content"])

    def test_mid_history_system_becomes_system_reminder(self) -> None:
        converted = _to_api_messages([
            {"role": "user", "content": "m1"},
            {"role": "system", "content": "[Context summary] facts"},
            {"role": "assistant", "content": "m2"},
        ])
        self.assertEqual([m["role"] for m in converted], ["user", "user", "assistant"])
        self.assertIn("<system-reminder>", converted[1]["content"])
        self.assertIn("[Context summary] facts", converted[1]["content"])

    def test_first_message_forced_to_user(self) -> None:
        converted = _to_api_messages([{"role": "assistant", "content": "hi"}])
        self.assertEqual(converted[0]["role"], "user")

    def test_block_list_content_passes_through(self) -> None:
        blocks = [{"type": "text", "text": "oi"}]
        converted = _to_api_messages([{"role": "user", "content": blocks}])
        self.assertEqual(converted[0]["content"], blocks)  # untouched

    def test_non_string_scalar_content_serialized(self) -> None:
        converted = _to_api_messages([{"role": "user", "content": {"k": "v"}}])
        self.assertIsInstance(converted[0]["content"], str)
        self.assertIn("v", converted[0]["content"])


class GatewayUsageWiringTest(unittest.TestCase):
    def test_turn_feeds_usage_to_compressor(self) -> None:
        import json
        import tempfile
        from pathlib import Path

        from opentracy.gateway import Gateway

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        (root / "soul.md").write_text("---\nmanaged: human\n---\n# Soul")

        def responder(system_prompt, messages):
            return {
                "role": "assistant",
                "content": "ok",
                "_usage": {"input_tokens": 50_000, "output_tokens": 10},
            }

        gateway = Gateway(root, responder=responder)
        self.addCleanup(gateway.close)
        session = gateway.open_session(ephemeral=True)
        gateway.turn("oi", session)

        # usage was recorded (compressor now counts from real usage)...
        self.assertEqual(gateway.compressor._last_real_prompt_tokens, 50_000)
        # ...and the side channel never leaked into the session tree
        stored = [e["message"] for e in session.get_entries() if e["type"] == "message"]
        self.assertNotIn("_usage", stored[-1])


if __name__ == "__main__":
    unittest.main()
