/**
 * WhatsApp via Baileys.
 *
 * Each agent gets one WASocket that joins WhatsApp Web as a linked
 * device. The user pairs by scanning the QR code we surface to the
 * UI; once paired, the socket reconnects automatically and credentials
 * persist under agents/<id>/integrations/whatsapp_creds/.
 *
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import QRCode from 'qrcode'

const RUNTIME_URL = process.env.RUNTIME_URL ?? 'http://127.0.0.1:8001'

// Baileys (GPLv3) is a reverse-engineered WhatsApp Web client kept as an
// optional dependency and loaded lazily only when this flag is set, so the
// default build neither requires the package nor joins WhatsApp.
const BAILEYS_ENABLED =
  process.env.OPENTRACY_ENABLE_BAILEYS === '1' ||
  process.env.OPENTRACY_ENABLE_BAILEYS === 'true'

export function isWhatsAppEnabled(): boolean {
  return BAILEYS_ENABLED
}

type WaSocket = {
  ev: { on: (event: string, cb: (arg: any) => void) => void }
  user?: { id?: string | null; name?: string | null } | null
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>
  logout: () => Promise<unknown>
}

interface SocketEntry {
  sock: WaSocket
  qrPng: string | null // data: URL when we're waiting for pairing
  connected: boolean
  jid: string | null
  pushName: string | null
  connectedAt: string | null
  lastError: string | null
  saveCreds: () => Promise<void>
}

const entries = new Map<string, SocketEntry>()
const starting = new Map<string, Promise<void>>()

export interface WhatsAppSocketStatus {
  agent_id: string
  active: boolean
  connected: boolean
  jid: string | null
  push_name: string | null
  connected_at: string | null
  qr_png: string | null
  last_error: string | null
}

export function getWhatsAppStatus(agentId: string): WhatsAppSocketStatus {
  const e = entries.get(agentId)
  return {
    agent_id: agentId,
    active: !!e,
    connected: !!e?.connected,
    jid: e?.jid ?? null,
    push_name: e?.pushName ?? null,
    connected_at: e?.connectedAt ?? null,
    qr_png: e?.qrPng ?? null,
    last_error: e?.lastError ?? null,
  }
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

function credsDir(agentId: string): string {
  return path.join(agentsRoot(), agentId, 'integrations', 'whatsapp_creds')
}

export function hasPersistedCreds(agentId: string): boolean {
  const dir = credsDir(agentId)
  if (!existsSync(dir)) return false
  // Baileys writes a `creds.json` once the pairing handshake finishes.
  return existsSync(path.join(dir, 'creds.json'))
}

async function runOnAgent(agentId: string, text: string): Promise<string> {
  const res = await fetch(`${RUNTIME_URL}/api/${encodeURIComponent(agentId)}/internal-run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request: text, channel: 'whatsapp' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`runtime ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { response?: string; error?: string }
  return data.response ?? data.error ?? 'Sorry — I have no response.'
}

interface IncomingMessage {
  key: { remoteJid?: string | null; fromMe?: boolean | null; id?: string | null }
  message?: {
    conversation?: string | null
    extendedTextMessage?: { text?: string | null } | null
  } | null
  pushName?: string | null
}

function extractText(m: IncomingMessage): string | null {
  const conv = m.message?.conversation
  if (conv) return conv
  const ext = m.message?.extendedTextMessage?.text
  if (ext) return ext
  return null
}

export async function openSocketFor(agentId: string): Promise<void> {
  if (!BAILEYS_ENABLED) return
  if (entries.has(agentId)) return
  const inflight = starting.get(agentId)
  if (inflight) return inflight

  const p = (async () => {
    const dir = credsDir(agentId)
    const spec = 'baileys'
    const baileys: any = await import(spec)
    const makeWASocket = baileys.default
    const { useMultiFileAuthState, DisconnectReason } = baileys
    const { state, saveCreds } = await useMultiFileAuthState(dir)
    const sock = makeWASocket({ auth: state }) as WaSocket

    const entry: SocketEntry = {
      sock,
      qrPng: null,
      connected: false,
      jid: null,
      pushName: null,
      connectedAt: null,
      lastError: null,
      saveCreds,
    }
    entries.set(agentId, entry)

    sock.ev.on('creds.update', () => {
      void saveCreds()
    })

    sock.ev.on('connection.update', (update) => {
      const { connection, qr, lastDisconnect } = update
      if (qr) {
        QRCode.toDataURL(qr, { margin: 1, scale: 6 })
          .then((png) => {
            entry.qrPng = png
          })
          .catch((e) => {
            console.warn('[wa] qr render failed:', (e as Error).message)
          })
      }
      if (connection === 'open') {
        entry.connected = true
        entry.qrPng = null
        entry.connectedAt = new Date().toISOString()
        entry.jid = sock.user?.id ?? null
        entry.pushName = sock.user?.name ?? null
        entry.lastError = null
        console.log(`[wa] connected for agent ${agentId} (${entry.jid})`)
      } else if (connection === 'close') {
        entry.connected = false
        const boomCode =
          (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
            ?.statusCode
        const loggedOut = boomCode === DisconnectReason.loggedOut
        entry.lastError = loggedOut
          ? 'logged out from phone'
          : (lastDisconnect?.error?.message ?? null)
        entries.delete(agentId)
        if (loggedOut) {
          // Creds invalidated by the phone — wipe and stay closed; the
          // user has to scan a new QR.
          void rm(dir, { recursive: true, force: true }).catch(() => {})
          console.log(`[wa] logged out for ${agentId}; wiped creds`)
          return
        }
        // Transient disconnect: reopen.
        console.log(`[wa] reconnecting for ${agentId}…`)
        setTimeout(() => {
          void openSocketFor(agentId).catch((e) =>
            console.warn(`[wa] reconnect failed for ${agentId}:`, (e as Error).message),
          )
        }, 1500)
      }
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify') return
      for (const m of messages as IncomingMessage[]) {
        if (m.key?.fromMe) continue
        const jid = m.key?.remoteJid
        if (!jid) continue
        // Skip groups for now — only DMs.
        if (jid.endsWith('@g.us')) continue
        const text = extractText(m)
        if (!text) continue
        void handleIncoming(agentId, jid, text).catch((e) =>
          console.error('[wa] handle threw:', e),
        )
      }
    })
  })()

  starting.set(agentId, p)
  try {
    await p
  } finally {
    starting.delete(agentId)
  }
}

async function handleIncoming(agentId: string, jid: string, text: string): Promise<void> {
  const entry = entries.get(agentId)
  if (!entry || !entry.connected) return
  try {
    const reply = await runOnAgent(agentId, text)
    await entry.sock.sendMessage(jid, { text: reply })
  } catch (e) {
    console.error('[wa] runtime call failed:', e instanceof Error ? e.message : String(e))
    try {
      await entry.sock.sendMessage(jid, { text: 'Sorry, something went wrong on my end.' })
    } catch {
      /* swallow */
    }
  }
}

export async function closeSocketFor(agentId: string): Promise<void> {
  const e = entries.get(agentId)
  if (!e) return
  try {
    await e.sock.logout()
  } catch {
    /* ignore */
  }
  entries.delete(agentId)
}

export async function wipeCredsFor(agentId: string): Promise<void> {
  await closeSocketFor(agentId)
  await rm(credsDir(agentId), { recursive: true, force: true }).catch(() => {})
}

export async function autoResumeWhatsAppSockets(): Promise<void> {
  if (!BAILEYS_ENABLED) return
  const root = agentsRoot()
  let dirs: string[]
  try {
    dirs = readdirSync(root)
  } catch {
    return
  }
  for (const entry of dirs) {
    if (entry.startsWith('.') || entry.startsWith('_deleted') || entry === '_shared') continue
    if (!hasPersistedCreds(entry)) continue
    try {
      await openSocketFor(entry)
    } catch (e) {
      console.warn(
        `[wa] auto-resume failed for ${entry}:`,
        (e as Error).message,
      )
    }
  }
}
