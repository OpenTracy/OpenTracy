/**
 * Generates a Slack App manifest pre-populated with bot scopes and
 * Socket Mode enabled. Used by the UI to bootstrap a Slack App with
 * one click:
 *
 *   https://api.slack.com/apps?new_app=1&manifest_json=<urlencoded>
 *
 * Socket Mode means Slack pushes events down a websocket we open from
 * the backend — no public URL required, no events Request URL to
 * verify, no OAuth callback. The user just needs to generate an
 * App-Level Token (xapp-…) and grab the Bot Token (xoxb-…) after
 * installing.
 */

export interface ManifestOptions {
  appName?: string
  botDisplayName?: string
}

interface SlackManifest {
  display_information: { name: string; description?: string }
  features: {
    bot_user: { display_name: string; always_online: boolean }
    app_home: {
      home_tab_enabled: boolean
      messages_tab_enabled: boolean
      messages_tab_read_only_enabled: boolean
    }
  }
  oauth_config: {
    scopes: { bot: string[] }
  }
  settings: {
    event_subscriptions: {
      bot_events: string[]
    }
    interactivity: { is_enabled: boolean }
    org_deploy_enabled: boolean
    socket_mode_enabled: boolean
    token_rotation_enabled: boolean
  }
}

const BOT_SCOPES = [
  'app_mentions:read',
  'chat:write',
  'im:history',
  'im:read',
  'im:write',
  'team:read',
]

const BOT_EVENTS = ['app_mention', 'message.im']

// Slack enforces hard ceilings on these fields. A manifest exceeding them
// renders with the red "We can't translate a manifest with errors" banner
// and the install URL is unusable — so the builder is the safest place to
// enforce them, regardless of what the caller passes in.
const SLACK_APP_NAME_MAX = 35
const SLACK_BOT_NAME_MAX = 80

function clip(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max).replace(/[-_\s]+$/, '')
}

export function buildManifest(opts: ManifestOptions): SlackManifest {
  const rawName = opts.appName ?? 'Opentracy Agent'
  const rawBot = opts.botDisplayName ?? rawName
  const name = clip(rawName, SLACK_APP_NAME_MAX)
  const bot = clip(rawBot, SLACK_BOT_NAME_MAX)
  return {
    display_information: {
      name,
      description: 'Self-improving AI agent harness',
    },
    features: {
      bot_user: { display_name: bot, always_online: true },
      app_home: {
        home_tab_enabled: false,
        // Required so users can DM the bot.
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
    },
    oauth_config: {
      scopes: { bot: BOT_SCOPES },
    },
    settings: {
      event_subscriptions: {
        bot_events: BOT_EVENTS,
      },
      interactivity: { is_enabled: false },
      org_deploy_enabled: false,
      socket_mode_enabled: true,
      token_rotation_enabled: false,
    },
  }
}

export function buildManifestInstallUrl(opts: ManifestOptions): string {
  const manifest = buildManifest(opts)
  const encoded = encodeURIComponent(JSON.stringify(manifest))
  return `https://api.slack.com/apps?new_app=1&manifest_json=${encoded}`
}
