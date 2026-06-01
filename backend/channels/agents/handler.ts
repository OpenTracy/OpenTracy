/**
 * Agents channel — proxy to runtime /agents/* endpoints (P2.0).
 *
 *  GET    /v1/agents              → list all agents in the registry
 *  GET    /v1/agents/:id          → one agent
 *  POST   /v1/agents              → create (used by onboarding launch flow)
 *  POST   /v1/agents/:id/activate → switch live agent + recompile pipeline
 *  DELETE /v1/agents/:id          → soft delete
 */

import { Hono } from 'hono'
import { proxyHeaders } from '../../auth/proxy_headers'
import {
  disconnectAgentSlack,
  getAgentSlackStatus,
  installAgentSlack,
  SlackInstallError,
} from '../slack/handler'
import { buildManifestInstallUrl } from '../slack/manifest'
import {
  connectAgentWhatsApp,
  disconnectAgentWhatsApp,
  getAgentWhatsAppStatus,
} from '../whatsapp/handler'

const RUNTIME_URL = process.env.RUNTIME_URL ?? 'http://127.0.0.1:8001'
const TIMEOUT_MS = 30_000

export const agentsRouter = new Hono()

const proxy = (
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT',
  pathBuilder: (c: import('hono').Context) => string,
) => async (c: import('hono').Context) => {
  let body: unknown = undefined
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const writeMethod = method === 'POST' || method === 'PATCH' || method === 'PUT'
    const headers = writeMethod
      ? { 'content-type': 'application/json', ...proxyHeaders(c) }
      : proxyHeaders(c)
    const res = await fetch(RUNTIME_URL + pathBuilder(c), {
      method,
      headers,
      body: writeMethod ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    })
    if (res.status === 204) {
      return c.body(null, 204)
    }
    // Pass the runtime's status through verbatim — including 4xx like
    // 404 (unknown agent), 409 (already_connected), 400 (validation).
    // The UI relies on these codes to choose its branch (e.g. "already
    // connected, prompt to rotate" vs "real error"). The gateway only
    // synthesizes its own 502 / 504 when fetch itself failed (below).
    const text = await res.text()
    const ct = res.headers.get('content-type') ?? 'application/json'
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': ct },
    })
  } catch (e) {
    return c.json(
      { error: 'runtime call failed', detail: e instanceof Error ? e.message : String(e) },
      502,
    )
  } finally {
    clearTimeout(timer)
  }
}

agentsRouter.get('/', proxy('GET', () => '/agents'))
agentsRouter.post('/', proxy('POST', () => '/agents'))
agentsRouter.get('/:id', proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}`))
agentsRouter.patch(
  '/:id',
  proxy('PATCH', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}`),
)
agentsRouter.get(
  '/:id/secrets',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/secrets`),
)
agentsRouter.put(
  '/:id/secrets',
  proxy('PUT', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/secrets`),
)
agentsRouter.get(
  '/:id/improvement',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/improvement`),
)
agentsRouter.put(
  '/:id/improvement',
  proxy('PUT', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/improvement`),
)
agentsRouter.get(
  '/:id/channels',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels`),
)

// MCP / Hands — per-agent tool servers (P3.4)
agentsRouter.get(
  '/:id/mcp',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/mcp`),
)
agentsRouter.post(
  '/:id/mcp',
  proxy('POST', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/mcp`),
)
agentsRouter.patch(
  '/:id/mcp/:server',
  proxy('PATCH', (c) =>
    `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/mcp/${encodeURIComponent(c.req.param('server') ?? '')}`,
  ),
)
agentsRouter.delete(
  '/:id/mcp/:server',
  proxy('DELETE', (c) =>
    `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/mcp/${encodeURIComponent(c.req.param('server') ?? '')}`,
  ),
)
agentsRouter.get(
  '/:id/mcp/tools',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/mcp/tools`),
)
agentsRouter.get(
  '/:id/channels/api',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/api`),
)
agentsRouter.post(
  '/:id/channels/api/connect',
  proxy('POST', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/api/connect`),
)
agentsRouter.post(
  '/:id/channels/api/rotate',
  proxy('POST', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/api/rotate`),
)
agentsRouter.delete(
  '/:id/channels/api',
  proxy('DELETE', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/api`),
)

// ─── Web widget channel (P3.5) ─────────────────────────────────────────────
// Operator-facing CRUD proxies straight to the Python runtime; storage,
// secret minting, and origin matching all live there.
agentsRouter.get(
  '/:id/channels/web',
  proxy('GET', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/web`),
)
agentsRouter.post(
  '/:id/channels/web/connect',
  proxy('POST', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/web/connect`),
)
agentsRouter.post(
  '/:id/channels/web/rotate-secret',
  proxy('POST', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/web/rotate-secret`),
)
agentsRouter.patch(
  '/:id/channels/web',
  proxy('PATCH', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/web`),
)
agentsRouter.delete(
  '/:id/channels/web',
  proxy('DELETE', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/channels/web`),
)

// ─── Slack channel (handled locally — OAuth files live in TS) ──────────────
agentsRouter.get('/:id/channels/slack', async (c) => {
  const id = c.req.param('id')
  try {
    return c.json(await getAgentSlackStatus(id))
  } catch (e) {
    return c.json(
      { error: 'slack status failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})

agentsRouter.delete('/:id/channels/slack', async (c) => {
  const id = c.req.param('id')
  try {
    await disconnectAgentSlack(id)
    return c.body(null, 204)
  } catch (e) {
    return c.json(
      { error: 'slack disconnect failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})

// Slack install (Socket Mode)
agentsRouter.post('/:id/channels/slack/install', async (c) => {
  const id = c.req.param('id') ?? ''
  let body: { bot_token?: string; app_token?: string; installer_user_id?: string | null }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid json' }, 400)
  }
  if (!body.bot_token || !body.app_token) {
    return c.json({ error: 'bot_token and app_token are required' }, 400)
  }
  try {
    return c.json(
      await installAgentSlack(id, {
        bot_token: body.bot_token,
        app_token: body.app_token,
        installer_user_id: body.installer_user_id ?? null,
      }),
    )
  } catch (e) {
    if (e instanceof SlackInstallError) return c.json({ error: e.message }, 400)
    return c.json(
      { error: 'slack install failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})

agentsRouter.get('/:id/channels/slack/manifest', (c) => {
  const id = c.req.param('id') ?? ''
  // Slack caps display_information.name at 35 chars. Reserve room for the
  // " (Opentracy)" suffix so it isn't lopped off when the agent id is long.
  const SUFFIX = ' (Opentracy)'
  const head = id.length > 35 - SUFFIX.length
    ? id.slice(0, 35 - SUFFIX.length).replace(/[-_\s]+$/, '')
    : id
  return c.json({
    install_url: buildManifestInstallUrl({
      appName: `${head}${SUFFIX}`,
      botDisplayName: id,
    }),
  })
})

// ─── WhatsApp via Baileys (linked device, QR pairing) ──────────────────────
agentsRouter.get('/:id/channels/whatsapp', async (c) => {
  const id = c.req.param('id') ?? ''
  return c.json(await getAgentWhatsAppStatus(id))
})

agentsRouter.post('/:id/channels/whatsapp/connect', async (c) => {
  const id = c.req.param('id') ?? ''
  try {
    return c.json(await connectAgentWhatsApp(id))
  } catch (e) {
    return c.json(
      { error: 'whatsapp connect failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})

agentsRouter.delete('/:id/channels/whatsapp', async (c) => {
  const id = c.req.param('id') ?? ''
  try {
    await disconnectAgentWhatsApp(id)
    return c.body(null, 204)
  } catch (e) {
    return c.json(
      { error: 'whatsapp disconnect failed', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})
agentsRouter.post(
  '/:id/activate',
  proxy('POST', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}/activate`),
)
agentsRouter.delete(
  '/:id',
  proxy('DELETE', (c) => `/agents/${encodeURIComponent(c.req.param('id') ?? '')}`),
)
