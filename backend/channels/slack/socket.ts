/**
 * Slack Socket Mode connection manager.
 *
 * Each connected agent gets a SocketModeClient that opens a websocket
 * to Slack using its App-Level Token (xapp-…). Slack pushes events
 * down the socket; we ack, run the agent's pipeline, and post the
 * reply back via the Web API using the bot token (xoxb-…).
 *
 * Sockets are reopened on backend boot from every persisted
 * slack.json so reboots don't require any user action.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { SocketModeClient } from '@slack/socket-mode'
import { readInstallation, type SlackInstallation } from './storage'

const RUNTIME_URL = process.env.RUNTIME_URL ?? 'http://127.0.0.1:8001'

interface SocketEntry {
  client: SocketModeClient
  startedAt: string
}

const clients = new Map<string, SocketEntry>()
const starting = new Map<string, Promise<void>>()

export interface SocketStatus {
  agent_id: string
  active: boolean
  started_at: string | null
}

export function getSocketStatus(agentId: string): SocketStatus {
  const entry = clients.get(agentId)
  return {
    agent_id: agentId,
    active: !!entry,
    started_at: entry?.startedAt ?? null,
  }
}

interface SlackInnerEvent {
  type: string
  user?: string
  bot_id?: string
  text?: string
  channel?: string
  channel_type?: string
  thread_ts?: string
  ts?: string
}

function stripBotMention(text: string, botUserId: string): string {
  return text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim()
}

function isHandleable(ev: SlackInnerEvent, botUserId: string): boolean {
  if (ev.bot_id) return false
  if (ev.user === botUserId) return false
  if (ev.type === 'app_mention') return true
  if (ev.type === 'message' && ev.channel_type === 'im') return true
  return false
}

async function runOnAgent(agentId: string, text: string): Promise<string> {
  const res = await fetch(`${RUNTIME_URL}/api/${encodeURIComponent(agentId)}/internal-run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request: text, channel: 'slack' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`runtime ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { response?: string; error?: string }
  return data.response ?? data.error ?? 'Sorry — I have no response.'
}

async function postReply(
  inst: SlackInstallation,
  channel: string,
  text: string,
  threadTs?: string,
): Promise<void> {
  const body: Record<string, unknown> = { channel, text }
  if (threadTs) body.thread_ts = threadTs
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      authorization: `Bearer ${inst.bot_token}`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!json.ok) {
    console.error('[slack socket] chat.postMessage failed:', json.error ?? res.status)
  }
}

interface SlackEventEnvelope {
  ack: (response?: unknown) => Promise<void>
  event: SlackInnerEvent
}

async function handleEvent(inst: SlackInstallation, envelope: SlackEventEnvelope): Promise<void> {
  const ev = envelope.event
  await envelope.ack()
  if (!ev || !ev.channel) return
  if (!isHandleable(ev, inst.bot_user_id)) return
  const text = stripBotMention(ev.text ?? '', inst.bot_user_id)
  if (!text) return
  try {
    const reply = await runOnAgent(inst.agent_id, text)
    await postReply(inst, ev.channel, reply, ev.thread_ts ?? ev.ts)
  } catch (e) {
    console.error('[slack socket] runtime call failed:', e instanceof Error ? e.message : String(e))
    await postReply(inst, ev.channel, 'Sorry, something went wrong on my end.', ev.thread_ts ?? ev.ts)
  }
}

export async function openSocketFor(inst: SlackInstallation): Promise<void> {
  if (clients.has(inst.agent_id)) return
  const inflight = starting.get(inst.agent_id)
  if (inflight) return inflight
  const p = (async () => {
    const client = new SocketModeClient({ appToken: inst.app_token })
    const dispatch = (envelope: SlackEventEnvelope) =>
      void handleEvent(inst, envelope).catch((e) =>
        console.error('[slack socket] handleEvent threw:', e),
      )
    client.on('app_mention', dispatch)
    client.on('message', dispatch)
    await client.start()
    clients.set(inst.agent_id, { client, startedAt: new Date().toISOString() })
    console.log(`[slack socket] connected for agent ${inst.agent_id} (team ${inst.team_name})`)
  })()
  starting.set(inst.agent_id, p)
  try {
    await p
  } finally {
    starting.delete(inst.agent_id)
  }
}

export async function closeSocketFor(agentId: string): Promise<void> {
  const entry = clients.get(agentId)
  if (!entry) return
  try {
    await entry.client.disconnect()
  } catch (e) {
    console.warn('[slack socket] disconnect failed:', (e as Error).message)
  }
  clients.delete(agentId)
}

export async function reopenSocketFor(agentId: string): Promise<void> {
  await closeSocketFor(agentId)
  const inst = await readInstallation(agentId)
  if (!inst) return
  await openSocketFor(inst)
}

function agentsRoot(): string {
  const fromEnv = process.env.OPENTRACY_AGENTS_ROOT
  if (fromEnv) return fromEnv
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    try {
      if (statSync(path.join(dir, 'agents')).isDirectory()) return path.join(dir, 'agents')
    } catch {
      /* keep climbing */
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.join(process.cwd(), 'agents')
}

export async function autoResumeSockets(): Promise<void> {
  const root = agentsRoot()
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.startsWith('.') || entry.startsWith('_deleted') || entry === '_shared') continue
    const file = path.join(root, entry, 'integrations', 'slack.json')
    try {
      const raw = readFileSync(file, 'utf8')
      const inst = JSON.parse(raw) as SlackInstallation
      if (!inst.app_token) continue
      try {
        await openSocketFor(inst)
      } catch (e) {
        console.warn(
          `[slack socket] auto-resume failed for ${inst.agent_id}:`,
          (e as Error).message,
        )
      }
    } catch {
      /* no install for this agent */
    }
  }
}
