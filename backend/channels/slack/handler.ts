/**
 * Slack channel handler — Socket Mode flow.
 *
 * The user creates a Slack App from a manifest with socket_mode_enabled,
 * generates an App-Level Token, installs to a workspace, then pastes
 * both the Bot User OAuth Token (xoxb-…) and the App-Level Token
 * (xapp-…) into the UI. We validate the bot token with auth.test to
 * capture team/user info, then open the websocket and persist the
 * install to agents/<id>/integrations/slack.json.
 */

import { Hono } from 'hono'
import { closeSocketFor, getSocketStatus, openSocketFor } from './socket'
import { clearInstallation, readInstallation, writeInstallation } from './storage'

export interface AgentSlackStatus {
  connected: boolean
  team_id: string | null
  team_name: string | null
  installer_user_id: string | null
  installed_at: string | null
  socket_active: boolean
  detail: string | null
}

export async function getAgentSlackStatus(agentId: string): Promise<AgentSlackStatus> {
  const inst = await readInstallation(agentId)
  const sock = getSocketStatus(agentId)
  return {
    connected: inst !== null,
    team_id: inst?.team_id ?? null,
    team_name: inst?.team_name ?? null,
    installer_user_id: inst?.installer_user_id ?? null,
    installed_at: inst?.installed_at ?? null,
    socket_active: sock.active,
    detail: null,
  }
}

export async function disconnectAgentSlack(agentId: string): Promise<void> {
  await closeSocketFor(agentId)
  await clearInstallation(agentId)
}

interface SlackAuthTestResponse {
  ok: boolean
  error?: string
  team_id?: string
  team?: string
  user_id?: string
  bot_id?: string
}

export class SlackInstallError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlackInstallError'
  }
}

export async function installAgentSlack(
  agentId: string,
  body: { bot_token: string; app_token: string; installer_user_id?: string | null },
): Promise<AgentSlackStatus> {
  const botToken = body.bot_token?.trim() ?? ''
  const appToken = body.app_token?.trim() ?? ''
  if (!botToken || !appToken) {
    throw new SlackInstallError('bot_token and app_token are both required')
  }
  if (!botToken.startsWith('xoxb-')) {
    throw new SlackInstallError('bot_token must start with xoxb-')
  }
  if (!appToken.startsWith('xapp-')) {
    throw new SlackInstallError('app_token must start with xapp-')
  }

  const res = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: { authorization: `Bearer ${botToken}` },
  })
  const data = (await res.json().catch(() => ({}))) as SlackAuthTestResponse
  if (!data.ok) {
    throw new SlackInstallError(`Slack rejected the bot token: ${data.error ?? `HTTP ${res.status}`}`)
  }
  if (!data.team_id || !data.user_id) {
    throw new SlackInstallError('Slack auth.test returned no team_id/user_id')
  }

  const inst = {
    agent_id: agentId,
    team_id: data.team_id,
    team_name: data.team ?? data.team_id,
    bot_user_id: data.user_id,
    bot_token: botToken,
    app_token: appToken,
    installer_user_id: body.installer_user_id ?? data.user_id,
    installed_at: new Date().toISOString(),
  }

  await closeSocketFor(agentId)
  try {
    await openSocketFor(inst)
  } catch (e) {
    throw new SlackInstallError(
      `Failed to open Socket Mode session: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  await writeInstallation(inst)
  return getAgentSlackStatus(agentId)
}

export const slackRouter = new Hono()
