import unittest

from opentracy.core.compression import (
    CompressionConfig,
    ContextCompressor,
    estimate_messages_tokens,
    is_context_overflow,
)


def msg(role: str, content: str) -> dict:
    return {"role": role, "content": content}


def conversation(n: int, chars_each: int = 400) -> list[dict]:
    msgs = [msg("system", "You are OpenTracy.")]
    for i in range(n):
        role = "user" if i % 2 == 0 else "assistant"
        msgs.append(msg(role, f"message {i}: " + "x" * chars_each))
    return msgs


SMALL = CompressionConfig(context_window=4_000, threshold=0.5)  # fires at 2,000 tok


class CheckMomentsTest(unittest.TestCase):
    def test_preflight_first_message_uses_rough_estimate(self) -> None:
        comp = ContextCompressor(config=SMALL)
        decision = comp.check_before_call(conversation(40))  # ~4k tokens
        self.assertTrue(decision.should_compress)
        self.assertEqual(decision.reason, "preflight-estimate")

    def test_preflight_below_threshold(self) -> None:
        comp = ContextCompressor(config=SMALL)
        decision = comp.check_before_call(conversation(4))
        self.assertFalse(decision.should_compress)
        self.assertEqual(decision.reason, "below-threshold")

    def test_usage_from_response_plus_added_messages(self) -> None:
        comp = ContextCompressor(config=SMALL)
        msgs = conversation(4)
        comp.update_from_response({"prompt_tokens": 1_990}, message_count=len(msgs))
        # real usage said 1,990; two new ~100-token messages push past 2,000
        msgs += [msg("user", "y" * 400), msg("assistant", "y" * 400)]
        decision = comp.check_before_call(msgs)
        self.assertTrue(decision.should_compress)
        self.assertEqual(decision.reason, "preflight-usage")
        self.assertGreater(decision.tokens, 1_990)

    def test_anthropic_style_usage_keys(self) -> None:
        comp = ContextCompressor(config=SMALL)
        comp.update_from_response({"input_tokens": 3_000}, message_count=4)
        self.assertTrue(comp.check_before_call(conversation(3)).should_compress)

    def test_error_moment_detects_overflow(self) -> None:
        comp = ContextCompressor(config=SMALL)
        short = conversation(2)  # even a below-threshold count must compress
        decision = comp.check_on_error("400: prompt is too long: 210000 tokens", short)
        self.assertTrue(decision.should_compress)
        self.assertEqual(decision.reason, "overflow-error")

    def test_error_moment_ignores_other_errors(self) -> None:
        comp = ContextCompressor(config=SMALL)
        decision = comp.check_on_error(RuntimeError("429 rate limited"), conversation(2))
        self.assertFalse(decision.should_compress)
        self.assertEqual(decision.reason, "not-overflow")

    def test_disabled_never_compresses(self) -> None:
        comp = ContextCompressor(config=CompressionConfig(enabled=False, context_window=4_000))
        self.assertFalse(comp.check_before_call(conversation(60)).should_compress)
        self.assertFalse(
            comp.check_on_error("context_length_exceeded", conversation(60)).should_compress
        )

    def test_overflow_marker_matching(self) -> None:
        self.assertTrue(is_context_overflow("Error: maximum context length is 200000"))
        self.assertFalse(is_context_overflow("connection reset by peer"))


class CompressTest(unittest.TestCase):
    def setUp(self) -> None:
        self.config = CompressionConfig(
            context_window=4_000, threshold=0.5, protect_first_n=3, protect_last_n=4
        )

    def test_head_summary_tail_assembly(self) -> None:
        comp = ContextCompressor(config=self.config, summarizer=lambda mid: "the summary")
        msgs = conversation(40)
        out = comp.compress(msgs)

        self.assertLess(len(out), len(msgs))
        self.assertEqual(out[:3], msgs[:3])                    # head verbatim
        self.assertEqual(out[-4:], msgs[-4:])                  # tail verbatim
        summary = out[3]
        self.assertEqual(summary["role"], "system")
        self.assertIn("the summary", summary["content"])
        self.assertIn("[Context summary", summary["content"])
        self.assertLess(
            estimate_messages_tokens(out), estimate_messages_tokens(msgs)
        )

    def test_summarizer_receives_only_the_middle(self) -> None:
        seen: list[list[dict]] = []
        comp = ContextCompressor(
            config=self.config, summarizer=lambda mid: seen.append(mid) or "s"
        )
        msgs = conversation(40)
        comp.compress(msgs)
        middle = seen[0]
        self.assertNotIn(msgs[0], middle)
        self.assertNotIn(msgs[-1], middle)

    def test_summarizer_failure_aborts_unchanged(self) -> None:
        def boom(mid):
            raise ConnectionError("aux model unreachable")

        comp = ContextCompressor(config=self.config, summarizer=boom)
        msgs = conversation(40)
        out = comp.compress(msgs)
        self.assertEqual(out, msgs)  # abort semantics: nothing destroyed
        self.assertIn("summarizer failed", comp.last_failure)

    def test_tool_results_pruned_outside_protected_regions(self) -> None:
        msgs = conversation(30)
        msgs[10] = {"role": "tool", "tool_call_id": "t1", "content": "z" * 5_000}
        comp = ContextCompressor(config=self.config)  # no summarizer: prune-only
        out = comp.compress(msgs)
        pruned = next(m for m in out if m.get("tool_call_id") == "t1")
        self.assertIn("[tool output pruned", pruned["content"])

    def test_tail_never_starts_on_tool_result(self) -> None:
        msgs = conversation(40)
        msgs[len(msgs) - 4] = {"role": "tool", "tool_call_id": "t2", "content": "ok"}
        comp = ContextCompressor(config=self.config, summarizer=lambda mid: "s")
        out = comp.compress(msgs)
        tail_start = next(i for i, m in enumerate(out) if "[Context summary" in str(m)) + 1
        self.assertNotEqual(out[tail_start]["role"], "tool")

    def test_short_conversation_untouched(self) -> None:
        comp = ContextCompressor(config=self.config, summarizer=lambda mid: "s")
        msgs = conversation(4)
        self.assertEqual(comp.compress(msgs), msgs)

    def test_anti_thrashing_backoff(self) -> None:
        # A summarizer that returns text as long as what it replaces: <10% savings.
        comp = ContextCompressor(
            config=self.config,
            summarizer=lambda mid: "n" * sum(len(m["content"]) for m in mid),
        )
        big = conversation(40)
        comp.compress(big)
        comp.compress(big)
        decision = comp.check_before_call(big)
        self.assertFalse(decision.should_compress)
        self.assertEqual(decision.reason, "thrashing")
        # force=True resets the backoff
        comp.compress(big, force=True)
        self.assertNotEqual(comp.check_before_call(big).reason, "thrashing")

    def test_summary_is_reference_only_with_end_marker(self) -> None:
        comp = ContextCompressor(config=self.config, summarizer=lambda mid: "facts here")
        out = comp.compress(conversation(40))
        summary = out[3]["content"]
        self.assertIn("REFERENCE ONLY", summary)
        self.assertIn("NOT as active instructions", summary)
        self.assertIn("END OF CONTEXT SUMMARY", summary)

    def test_second_compaction_resummarizes_previous_summary(self) -> None:
        # The summary message sits right after the head, so the next
        # compaction feeds it back to the summarizer (iterative updates).
        seen: list[list[dict]] = []
        comp = ContextCompressor(
            config=self.config, summarizer=lambda mid: seen.append(mid) or "s1"
        )
        out1 = comp.compress(conversation(40))
        out2 = comp.compress(out1 + conversation(40)[1:])  # session keeps growing
        middle_of_second = seen[1]
        self.assertTrue(any("REFERENCE ONLY" in str(m) for m in middle_of_second))
        self.assertLess(len(out2), len(out1) + 39)

    def test_max_output_tokens_shrinks_effective_window(self) -> None:
        from opentracy.core.compression import CompressionConfig

        with_reservation = CompressionConfig(
            context_window=4_000, threshold=0.5, max_output_tokens=2_000
        )
        self.assertEqual(with_reservation.threshold_tokens, 1_000)  # (4000-2000)*0.5
        degenerate = CompressionConfig(
            context_window=4_000, threshold=0.5, max_output_tokens=5_000
        )
        self.assertEqual(degenerate.threshold_tokens, 2_000)  # falls back to full window

    def test_usage_tracking_resets_after_compression(self) -> None:
        comp = ContextCompressor(config=self.config, summarizer=lambda mid: "s")
        msgs = conversation(40)
        comp.update_from_response({"prompt_tokens": 3_000}, message_count=len(msgs))
        out = comp.compress(msgs)
        # stale pre-compression usage must not drive the next preflight
        self.assertEqual(comp.current_tokens(out), estimate_messages_tokens(out))


if __name__ == "__main__":
    unittest.main()
