import json
import tempfile
import unittest
from pathlib import Path

from opentracy.core.session import SESSION_VERSION, SessionManager
from opentracy.memory import TranscriptStore


def user(text: str) -> dict:
    return {"role": "user", "content": text}


def assistant(text: str) -> dict:
    return {"role": "assistant", "content": [{"type": "text", "text": text}]}


class SessionTreeTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)

    def test_header_and_append_chain(self) -> None:
        s = SessionManager.create(self.root)
        a = s.append_message(user("hello"))
        b = s.append_message(assistant("hi!"))
        lines = [json.loads(l) for l in s.path.read_text().splitlines()]
        self.assertEqual(lines[0]["type"], "session")
        self.assertEqual(lines[0]["version"], SESSION_VERSION)
        self.assertIsNone(lines[1]["parentId"])  # first entry roots the tree
        self.assertEqual(lines[2]["parentId"], a)
        self.assertEqual(s.get_leaf_id(), b)

    def test_branching_creates_sibling_and_moves_leaf(self) -> None:
        s = SessionManager.in_memory()
        a = s.append_message(user("hello"))
        s.append_message(assistant("of course"))
        approach_a = s.append_message(user("try approach A"))
        s.append_message(assistant("doing A"))

        reply = s.get_entries()[1]["id"]  # assistant "of course"
        s.branch(reply)  # jump back to just after the assistant's reply
        approach_b = s.append_message(user("actually, approach B"))

        # the reply now has two children: approach A and approach B
        self.assertEqual(
            {e["id"] for e in s.get_children(reply)}, {approach_a, approach_b}
        )
        # active branch contains B, not A
        active = [e["id"] for e in s.get_branch()]
        self.assertIn(approach_b, active)
        self.assertNotIn(approach_a, active)
        self.assertIn(a, active)  # shared history stays

    def test_build_context_entries_honors_compaction(self) -> None:
        s = SessionManager.in_memory()
        s.append_message(user("m1"))
        s.append_message(assistant("m2"))
        kept = s.append_message(user("m3"))
        s.append_message(assistant("m4"))
        s.append_compaction("summary of m1-m2", first_kept_entry_id=kept, tokens_before=50_000)
        s.append_message(user("m5"))

        entries = s.build_context_entries()
        self.assertEqual(entries[0]["type"], "compaction")  # summary leads
        contents = [
            e["message"]["content"] for e in entries if e["type"] == "message"
        ]
        self.assertEqual(contents[0], "m3")  # m1/m2 dropped, kept-range survives
        self.assertIn("m5", str(contents))

    def test_build_session_context_messages_and_model(self) -> None:
        s = SessionManager.in_memory()
        s.append_message(user("m1"))
        s.append_model_change("anthropic", "claude-fable-5")
        s.append_thinking_level_change("high")
        s.append_custom("my-ext", {"count": 42})            # never in context
        s.append_custom_message("my-ext", "injected fact")  # in context
        ctx = s.build_session_context()
        self.assertEqual(ctx["provider"], "anthropic")
        self.assertEqual(ctx["model"], "claude-fable-5")
        self.assertEqual(ctx["thinking_level"], "high")
        roles = [m["role"] for m in ctx["messages"]]
        self.assertEqual(roles, ["user", "user"])  # m1 + injected; custom state absent
        self.assertIn("injected fact", ctx["messages"][-1]["content"])

    def test_branch_with_summary_preserves_abandoned_context(self) -> None:
        s = SessionManager.in_memory()
        a = s.append_message(user("hello"))
        s.append_message(assistant("working on approach A..."))
        old_leaf = s.get_leaf_id()
        summary_id = s.branch_with_summary(a, "Branch explored approach A; it failed on X.")
        entry = s.get_entry(summary_id)
        self.assertEqual(entry["type"], "branch_summary")
        self.assertEqual(entry["fromId"], old_leaf)
        self.assertEqual(entry["parentId"], a)
        ctx = s.build_session_context()
        self.assertIn("approach A", ctx["messages"][-1]["content"])

    def test_reload_from_disk_continues_at_leaf(self) -> None:
        s = SessionManager.create(self.root)
        s.append_message(user("persist me"))
        leaf = s.append_message(assistant("saved"))
        reopened = SessionManager.open(s.path)
        self.assertEqual(reopened.get_leaf_id(), leaf)
        self.assertEqual(reopened.session_id, s.session_id)
        nxt = reopened.append_message(user("continuing"))
        self.assertEqual(reopened.get_entry(nxt)["parentId"], leaf)

    def test_continue_recent_and_create_fallback(self) -> None:
        fresh = SessionManager.continue_recent(self.root)  # nothing exists yet
        fresh.append_message(user("first session"))
        resumed = SessionManager.continue_recent(self.root)
        self.assertEqual(resumed.session_id, fresh.session_id)

    def test_create_branched_session_forks_to_new_file(self) -> None:
        s = SessionManager.create(self.root)
        s.append_message(user("shared history"))
        keep = s.append_message(assistant("useful reply"))
        s.append_message(user("divergent continuation"))

        fork = s.create_branched_session(leaf_id=keep)
        self.assertNotEqual(fork.path, s.path)
        self.assertEqual(fork.header["parentSession"], str(s.path))
        contents = [
            e["message"] for e in fork.get_entries() if e["type"] == "message"
        ]
        self.assertEqual(len(contents), 2)  # up to the chosen leaf only
        # original untouched
        self.assertEqual(
            len([e for e in s.get_entries() if e["type"] == "message"]), 3
        )

    def test_session_name_and_list(self) -> None:
        s = SessionManager.create(self.root)
        s.append_message(user("audit the build"))
        s.append_session_info("CI audit")
        s2 = SessionManager.create(self.root)
        s2.append_message(user("other work"))

        infos = SessionManager.list(self.root)
        self.assertEqual(len(infos), 2)
        by_id = {i["id"]: i for i in infos}
        self.assertEqual(by_id[s.session_id]["name"], "CI audit")
        self.assertIsNone(by_id[s2.session_id]["name"])
        self.assertEqual(by_id[s.session_id]["message_count"], 1)
        self.assertEqual(by_id[s.session_id]["first_message"], "audit the build")

    def test_labels_round_trip(self) -> None:
        s = SessionManager.in_memory()
        a = s.append_message(user("checkpoint here"))
        s.append_label(a, "checkpoint-1")
        labels = [e for e in s.get_entries() if e["type"] == "label"]
        self.assertEqual(labels[0]["targetId"], a)
        self.assertEqual(labels[0]["label"], "checkpoint-1")

    def test_in_memory_is_not_persisted(self) -> None:
        s = SessionManager.in_memory()
        s.append_message(user("ephemeral"))
        self.assertFalse(s.is_persisted())

    def test_sqlite_mirror_receives_every_message(self) -> None:
        store = TranscriptStore(self.root / "sessions" / "transcripts.db")
        self.addCleanup(store.close)
        s = SessionManager.create(self.root, mirror=store)
        s.append_message(user("mirrored?"))
        s.append_message(assistant("yes"))
        s.append_session_info("named")  # non-message entries are NOT mirrored
        transcript = store.get_transcript(s.session_id)
        self.assertEqual(len(transcript), 2)
        self.assertEqual(transcript[0]["content"], "mirrored?")
        # reopening with the same mirror must not crash on duplicate session id
        reopened = SessionManager.open(s.path, mirror=store)
        reopened.append_message(user("still mirrored"))
        self.assertEqual(store.message_count(s.session_id), 3)


if __name__ == "__main__":
    unittest.main()
