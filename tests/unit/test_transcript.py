import tempfile
import unittest
from pathlib import Path

from opentracy.memory import NullExternalMemory, TranscriptStore


class TranscriptStoreTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.db = Path(self._tmp.name) / "sessions" / "transcripts.db"
        self.store = TranscriptStore(self.db)
        self.addCleanup(self.store.close)

    def test_lossless_round_trip(self) -> None:
        sid = self.store.begin_session()
        messages = [
            {"role": "user", "content": "olá — find the config"},
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {"id": "t1", "function": {"name": "read_file", "arguments": '{"path": "a.py"}'}}
                ],
            },
            {"role": "tool", "tool_call_id": "t1", "content": "file contents"},
            {"role": "assistant", "content": [{"type": "text", "text": "done ✓"}]},
        ]
        for m in messages:
            self.store.append(sid, m)
        self.assertEqual(self.store.get_transcript(sid), messages)

    def test_seq_is_per_session_and_ordered(self) -> None:
        a = self.store.begin_session()
        b = self.store.begin_session()
        self.assertEqual(self.store.append(a, {"role": "user", "content": "1"}), 1)
        self.assertEqual(self.store.append(b, {"role": "user", "content": "1"}), 1)
        self.assertEqual(self.store.append(a, {"role": "assistant", "content": "2"}), 2)
        self.assertEqual(self.store.message_count(a), 2)
        self.assertEqual(self.store.message_count(b), 1)

    def test_persists_across_reopen(self) -> None:
        sid = self.store.begin_session()
        self.store.append(sid, {"role": "user", "content": "durable?"})
        self.store.close()
        reopened = TranscriptStore(self.db)
        self.addCleanup(reopened.close)
        self.assertEqual(
            reopened.get_transcript(sid), [{"role": "user", "content": "durable?"}]
        )

    def test_end_session_records_summary(self) -> None:
        sid = self.store.begin_session(metadata={"channel": "cli"})
        self.store.append(sid, {"role": "user", "content": "hi"})
        self.store.end_session(sid, summary="greeted the user")
        info = self.store.list_sessions()[0]
        self.assertEqual(info["id"], sid)
        self.assertEqual(info["summary"], "greeted the user")
        self.assertEqual(info["metadata"], {"channel": "cli"})
        self.assertIsNotNone(info["ended_at"])
        self.assertEqual(info["message_count"], 1)

    def test_end_unknown_session_raises(self) -> None:
        with self.assertRaises(KeyError):
            self.store.end_session("s-nope")

    def test_message_requires_role(self) -> None:
        sid = self.store.begin_session()
        with self.assertRaises(ValueError):
            self.store.append(sid, {"content": "no role"})

    def test_list_sessions_newest_first(self) -> None:
        first = self.store.begin_session(session_id="s-first")
        second = self.store.begin_session(session_id="s-second")
        listed = [s["id"] for s in self.store.list_sessions()]
        self.assertEqual(set(listed), {first, second})
        self.assertEqual(len(listed), 2)

    def test_search_messages_across_sessions(self) -> None:
        a = self.store.begin_session()
        b = self.store.begin_session()
        self.store.append(a, {"role": "user", "content": "deploy the match service"})
        self.store.append(b, {"role": "assistant", "content": "match rate is 92%"})
        self.store.append(b, {"role": "user", "content": "unrelated"})
        hits = self.store.search_messages("match")
        self.assertEqual(len(hits), 2)
        self.assertEqual({h["session_id"] for h in hits}, {a, b})

    def test_compression_never_touches_the_record(self) -> None:
        # The working list may shrink via compression; the store must not.
        from opentracy.core.compression import CompressionConfig, ContextCompressor

        sid = self.store.begin_session()
        msgs = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i} " + "x" * 200}
                for i in range(30)]
        for m in msgs:
            self.store.append(sid, m)
        comp = ContextCompressor(
            config=CompressionConfig(context_window=2_000, protect_last_n=4),
            summarizer=lambda mid: "s",
        )
        working = comp.compress(msgs)
        self.assertLess(len(working), len(msgs))
        self.assertEqual(self.store.get_transcript(sid), msgs)  # untouched


class NullExternalMemoryTest(unittest.TestCase):
    def test_null_provider_is_inert(self) -> None:
        provider = NullExternalMemory()
        provider.ingest("s-1", [{"role": "user", "content": "hi"}])
        self.assertEqual(provider.recall("anything"), [])


if __name__ == "__main__":
    unittest.main()
