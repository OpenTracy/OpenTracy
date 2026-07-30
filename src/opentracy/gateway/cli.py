"""The `opentracy` command — the CLI frontend to the Gateway.

    opentracy run "prompt"       one-shot turn (prints the reply)
    opentracy chat               interactive REPL
    opentracy sessions           list sessions for this workspace
    opentracy search "text"      search all transcripts (SQLite mirror)
    opentracy context            show the assembled context stack + token report
    opentracy ticks              run one scheduler tick over jobs.json

Session flags (run/chat): -c continue recent · --session PATH · --name NAME ·
--no-session ephemeral. All commands accept --root (default: cwd).
"""

from __future__ import annotations

import argparse
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable

from opentracy.gateway.gateway import Gateway

# harness commands runnable from inside the chat via /<name> — no LLM involved
CHAT_COMMANDS = ("versions", "rollback", "sessions", "search", "context", "ticks")

CHAT_HELP = """\
/help                 this help
/session              current session info
/name <name>          name this session
/new                  finalize current session and start a new one
/exit  /quit          finalize and leave
/versions [--show REF] [--diff A B]   agent version tree
/rollback <ref>       restore agent config to a version
/sessions             list sessions
/search <text>        search all transcripts
/context              show the context stack
/ticks                run scheduled jobs now
!<command>            run a shell command directly (output enters the
                      conversation context so the agent sees it)"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="opentracy", description="OpenTracy agent"
    )
    parser.add_argument("--root", default=".", help="workspace root (default: cwd)")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_session_flags(p: argparse.ArgumentParser) -> None:
        p.add_argument("-c", "--continue", dest="continue_recent", action="store_true",
                       help="continue the most recent session")
        p.add_argument("--session", help="use a specific session file")
        p.add_argument("--name", help="set the session display name")
        p.add_argument("--no-session", action="store_true",
                       help="ephemeral mode; do not save")
        p.add_argument("-v", "--verbose", action="store_true",
                       help="print context/compression diagnostics to stderr")

    run = sub.add_parser("run", help="one-shot turn")
    run.add_argument("prompt", nargs="+", help="the user message")
    add_session_flags(run)

    chat = sub.add_parser("chat", help="interactive REPL")
    add_session_flags(chat)

    sub.add_parser("sessions", help="list sessions")

    search = sub.add_parser("search", help="search all transcripts")
    search.add_argument("text")
    search.add_argument("--limit", type=int, default=20)

    sub.add_parser("context", help="show the assembled context stack")

    ticks = sub.add_parser("ticks", help="run a scheduler tick over jobs.json")
    ticks.add_argument("--watch", type=int, metavar="SECONDS",
                       help="keep ticking on an interval")

    versions = sub.add_parser("versions", help="agent version tree (ADR-0007)")
    versions.add_argument("--show", metavar="REF", help="full changelog of a version")
    versions.add_argument("--diff", nargs=2, metavar=("A", "B"),
                          help="diff the config plane between two versions")

    rollback = sub.add_parser(
        "rollback", help="restore agent config to a version (as a NEW version)")
    rollback.add_argument("ref", help="version to restore, e.g. v3")
    return parser


def _open_session(gateway: Gateway, args: argparse.Namespace):
    return gateway.open_session(
        continue_recent=args.continue_recent,
        session_path=args.session,
        ephemeral=args.no_session,
        name=args.name,
    )


def _diagnostics(result, out: Callable[[str], None]) -> None:
    tokens = sum(s["tokens"] for s in result.context_report.values())
    comp = result.compression
    out(f"[session {result.session_id[:8]}] context {tokens} tok · "
        f"messages {comp.tokens}/{comp.threshold_tokens} tok · "
        f"compression: {comp.reason}")


def cmd_run(gateway: Gateway, args: argparse.Namespace) -> int:
    session = _open_session(gateway, args)
    result = gateway.turn(" ".join(args.prompt), session)
    if args.verbose:
        _diagnostics(result, lambda s: print(s, file=sys.stderr))
    print(result.reply)
    return 0


def cmd_chat(
    gateway: Gateway,
    args: argparse.Namespace,
    input_fn: Callable[[str], str] = input,
    print_fn: Callable[[str], None] = print,
) -> int:
    session = _open_session(gateway, args)
    print_fn(f"opentracy chat — session {session.session_id[:8]} "
             f"({'ephemeral' if not session.is_persisted() else session.path.name}). "
             "/help for commands, /exit to quit.")

    def run_slash(line: str) -> None:
        """Dispatch /command directly to the CLI handlers — no LLM call."""
        try:
            parts = shlex.split(line[1:])
        except ValueError as exc:
            print_fn(f"[parse error: {exc}]")
            return
        name, rest = parts[0], parts[1:]
        try:
            cmd_args = build_parser().parse_args(
                ["--root", str(gateway.root), name, *rest]
            )
        except SystemExit:
            print_fn(f"[invalid arguments — see /help]")
            return
        dispatch = {
            "versions": lambda: cmd_versions(gateway, cmd_args),
            "rollback": lambda: cmd_rollback(gateway, cmd_args),
            "sessions": lambda: cmd_sessions(gateway),
            "search": lambda: cmd_search(gateway, cmd_args),
            "context": lambda: cmd_context(gateway),
            "ticks": lambda: cmd_ticks(gateway, cmd_args),
        }
        dispatch[name]()

    def run_bang(line: str) -> None:
        """! prefix: run shell directly; the output joins the conversation
        context (recorded as a custom_message) so the agent sees it."""
        command = line[1:].strip()
        if not command:
            return
        try:
            proc = subprocess.run(
                command, shell=True, cwd=gateway.root, capture_output=True,
                text=True, timeout=120, executable="/bin/bash",
            )
            output = ((proc.stdout or "") + (proc.stderr or "")).strip()
            if proc.returncode != 0:
                output += f"\n[exit code: {proc.returncode}]"
        except subprocess.TimeoutExpired:
            output = "[command timed out after 120s]"
        output = output.strip() or "(no output)"
        print_fn(output if len(output) <= 30_000 else output[:30_000] + "\n[clipped]")
        session.append_custom_message(
            "bash-execution", f"$ {command}\n{output[:10_000]}", display=False
        )

    def finalize() -> None:
        summary = gateway.finalize_session(session)
        if summary:
            print_fn(f"[session {session.session_id[:8]} summarized → "
                     "sessions/past_sessions.md]")

    while True:
        try:
            line = input_fn("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print_fn("")
            finalize()
            return 0
        if not line:
            continue
        if line in ("/exit", "/quit"):
            finalize()
            return 0
        if line in ("/help", "/?"):
            print_fn(CHAT_HELP)
            continue
        if line == "/new":
            finalize()
            session = gateway.open_session()
            print_fn(f"new session {session.session_id[:8]}")
            continue
        if line.startswith("!"):
            run_bang(line)
            continue
        if line.startswith("/"):
            name = line[1:].split()[0] if len(line) > 1 else ""
            if name in CHAT_COMMANDS:
                run_slash(line)
                continue
            if name not in ("session", "name"):
                print_fn(f"[unknown command /{name} — /help lists commands; "
                         "message text starting with / is not sent to the agent]")
                continue
        if line.startswith("/name "):
            session.append_session_info(line.removeprefix("/name ").strip())
            print_fn("named.")
            continue
        if line == "/session":
            messages = [e for e in session.get_entries() if e["type"] == "message"]
            print_fn(f"id: {session.session_id}\nfile: {session.path}\n"
                     f"name: {session.get_session_name() or '(unnamed)'}\n"
                     f"messages: {len(messages)}")
            continue
        result = gateway.turn(line, session)
        if args.verbose:
            _diagnostics(result, print_fn)
        print_fn(result.reply)


def cmd_sessions(gateway: Gateway) -> int:
    infos = gateway.list_sessions()
    if not infos:
        print("no sessions yet.")
        return 0
    for info in infos:
        label = info["name"] or (info["first_message"] or "")[:60] or "(empty)"
        print(f"{info['id'][:8]}  {info['created_at'][:16]}  "
              f"{info['message_count']:>4} msg  {label}")
    return 0


def cmd_search(gateway: Gateway, args: argparse.Namespace) -> int:
    hits = gateway.search(args.text, limit=args.limit)
    if not hits:
        print("no matches.")
        return 0
    for hit in hits:
        content = hit["content"]
        if not isinstance(content, str):
            content = str(content)
        snippet = " ".join(content.split())[:100]
        print(f"{hit['session_id'][:8]} #{hit['seq']:<3} {hit['role']:<9} {snippet}")
    return 0


def cmd_context(gateway: Gateway) -> int:
    report = gateway.context_report()
    width = 40
    scale = max((s["tokens"] for s in report["sources"].values()), default=1)
    for source, stats in report["sources"].items():
        bar = "█" * max(1, round(stats["tokens"] / scale * width))
        flag = "  (truncated)" if stats["truncated"] else ""
        print(f"{source:>14} │ {bar:<{width}} {stats['tokens']:>6} tok{flag}")
    print(f"{'TOTAL':>14} │ {'':<{width}} {report['total_tokens']:>6} tok")
    return 0


def cmd_versions(gateway: Gateway, args: argparse.Namespace) -> int:
    versioner = gateway.versioner
    versioner.ensure_init()
    # commit any pending manual edits first, so the listing is truthful
    if versioner.is_dirty():
        gateway._commit_config_change(trigger="manual", session=None)
        print("[pending manual changes committed as a new version]\n", file=sys.stderr)

    if args.show:
        print(versioner.show(args.show))
        return 0
    if args.diff:
        print(versioner.diff(args.diff[0], args.diff[1]))
        return 0
    for v in reversed(versioner.list_versions()):  # newest first
        print(f"{v.tag:>5}  {v.sha}  {v.date}  {v.subject}")
    return 0


def cmd_rollback(gateway: Gateway, args: argparse.Namespace) -> int:
    version = gateway.versioner.rollback(args.ref)
    print(f"restored config plane to {args.ref} → committed as {version.tag}")
    print("(nothing was lost: later versions remain in history; "
          f"`opentracy rollback <ref>` can undo this too)")
    return 0


def cmd_ticks(gateway: Gateway, args: argparse.Namespace) -> int:
    while True:
        results = gateway.tick()
        if results:
            for r in results:
                print(f"{r.job_id} [{r.status}] {r.run_id} → {r.run_file}")
        else:
            print("nothing due.")
        if not args.watch:
            return 0
        time.sleep(args.watch)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    gateway = Gateway(Path(args.root).resolve())
    from opentracy.gateway.gateway import EchoResponder

    if isinstance(gateway.responder, EchoResponder):
        print(
            "[opentracy] no Anthropic credentials found — using the echo responder. "
            "Export ANTHROPIC_API_KEY (or run `ant auth login`) to talk to Claude.",
            file=sys.stderr,
        )
    try:
        if args.command == "run":
            return cmd_run(gateway, args)
        if args.command == "chat":
            return cmd_chat(gateway, args)
        if args.command == "sessions":
            return cmd_sessions(gateway)
        if args.command == "search":
            return cmd_search(gateway, args)
        if args.command == "context":
            return cmd_context(gateway)
        if args.command == "ticks":
            return cmd_ticks(gateway, args)
        if args.command == "versions":
            return cmd_versions(gateway, args)
        if args.command == "rollback":
            return cmd_rollback(gateway, args)
        raise AssertionError(f"unhandled command {args.command}")
    finally:
        gateway.close()


if __name__ == "__main__":
    raise SystemExit(main())
