/**
 * WhatsApp channel handler — Baileys flow.
 *
 * Lifecycle:
 *   - getAgentWhatsAppStatus(agentId): UI polls this; returns whether
 *     the socket is up, the JID after pairing, or the QR PNG while
 *     waiting for the user to scan.
 *   - connectAgentWhatsApp(agentId): opens the socket. If creds exist,
 *     reconnects silently. If not, surfaces a QR for the UI to display.
 *   - disconnectAgentWhatsApp(agentId): logs out + wipes creds dir.
 */

import {
  getWhatsAppStatus,
  hasPersistedCreds,
  isWhatsAppEnabled,
  openSocketFor,
  wipeCredsFor,
} from './socket'

export interface AgentWhatsAppStatus {
  configured: boolean // socket has been opened at least once this session
  connected: boolean // paired and currently online
  jid: string | null
  push_name: string | null
  connected_at: string | null
  qr_png: string | null
  has_persisted_creds: boolean
  last_error: string | null
}

export async function getAgentWhatsAppStatus(agentId: string): Promise<AgentWhatsAppStatus> {
  const s = getWhatsAppStatus(agentId)
  return {
    configured: s.active,
    connected: s.connected,
    jid: s.jid,
    push_name: s.push_name,
    connected_at: s.connected_at,
    qr_png: s.qr_png,
    has_persisted_creds: hasPersistedCreds(agentId),
    last_error: s.last_error,
  }
}

export async function connectAgentWhatsApp(agentId: string): Promise<AgentWhatsAppStatus> {
  if (!isWhatsAppEnabled()) {
    const status = await getAgentWhatsAppStatus(agentId)
    return { ...status, last_error: 'whatsapp_disabled: set OPENTRACY_ENABLE_BAILEYS=1 to enable' }
  }
  await openSocketFor(agentId)
  return getAgentWhatsAppStatus(agentId)
}

export async function disconnectAgentWhatsApp(agentId: string): Promise<void> {
  await wipeCredsFor(agentId)
}
