"""MCP server exposing introspection tools (stdio transport).

Run via:
  uv run python -m harness.introspection.mcp_server     # stdio for Claude Code

Registered in ``.mcp.json`` at the repo root so Claude Code (or any
MCP client) discovers it automatically when you open this project.
This is the **OSS local** entry point — the same set of tools is
exposed over HTTP/SSE by ``runtime/mcp/http.py`` for the hosted
deploy (P16.2), but that path is flag-gated and never used by
operators who clone the repo and run locally.

Tool definitions + handlers live in :mod:`harness.introspection.tools`
so both transports stay in sync. This module is intentionally tiny.
"""

from __future__ import annotations

import asyncio

from mcp.server import Server
from mcp.server.stdio import stdio_server

from harness.introspection.tools import register


server: Server = Server("opentracy-introspection")
register(server)


async def main() -> None:
    # The spawner (brain CLI) passes OPENTRACY_AGENT_ID / OPENTRACY_TENANT_ID so
    # this server's tool calls resolve the SAME agent/tenant, not _default.
    import os

    from runtime import agent_context

    agent_id = os.environ.get("OPENTRACY_AGENT_ID")
    if agent_id:
        agent_context.set_active(agent_id)
    tenant_id = os.environ.get("OPENTRACY_TENANT_ID")
    if tenant_id:
        from runtime import tenant_context

        tenant_context.set_active(tenant_id)

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
