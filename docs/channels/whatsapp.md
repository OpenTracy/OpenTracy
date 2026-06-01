# WhatsApp channel (Baileys) — opt-in

OpenTracy can connect an agent to WhatsApp by joining WhatsApp Web as a linked
device, using [Baileys](https://github.com/WhiskeySockets/Baileys). This is
**off by default** and must be explicitly enabled.

## ⚠️ Read before enabling

- **License.** Baileys is **GPLv3 (copyleft)**. OpenTracy itself is MIT and does
  not bundle Baileys — it is declared as an *optional* dependency and loaded
  lazily only when you enable this channel. If you redistribute a build with
  Baileys installed, the GPLv3 obligations apply to that distribution.
- **Unofficial / ToS.** Baileys is a reverse-engineered WhatsApp Web client. It
  is **not** an official WhatsApp/Meta product. Automated or third-party access
  can violate WhatsApp's Terms of Service, and the paired phone number can be
  rate-limited or banned. Use a number you control and accept this risk.
- **Stability.** Because it tracks an unofficial protocol, it can break when
  WhatsApp changes its web client.

## Enable it

1. Install the optional dependency (skipped by default installs that use
   `--omit=optional`):

   ```bash
   cd backend && npm install baileys
   ```

2. Set the feature flag for the backend process:

   ```bash
   OPENTRACY_ENABLE_BAILEYS=1 npm run dev
   ```

When the flag is unset, the connect endpoint returns a `whatsapp_disabled`
status, no Baileys code is loaded, and sockets are not resumed on boot.

## Pair a number

1. In the UI, open the agent's WhatsApp channel and click **Connect**.
2. A QR code is shown. Scan it from **WhatsApp → Linked devices** on the phone
   you want the agent to use.
3. Once paired, credentials persist under
   `agents/<id>/integrations/whatsapp_creds/` and the socket reconnects
   automatically on restart. Disconnecting wipes those credentials.

Only direct messages are handled; group messages are ignored.
