# OpenTracy UI

The React dashboard for a self-hosted OpenTracy stack — traces, distillation jobs, deployments, routing intelligence.

## Run it

The UI ships with the Docker Compose stack in the repo root. From `../`:

```bash
docker compose up opentracy-ui
```

Nginx serves the built bundle on `http://localhost:3000` and proxies `/api`
to `opentracy-api:8000` and `/engine` to `opentracy-engine:8080` over the
compose network — no external services required.

## Develop locally

```bash
cd ui
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

The dev server does not proxy — point the UI at a running API/engine via env vars:

```bash
VITE_API_BASE_URL=http://localhost:8000 \
VITE_ROUTER_URL=http://localhost:8080 \
  npm run dev
```

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` + `vite build` production bundle |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |

## Notes on auth

The UI used to ship with AWS Amplify (Cognito) for cloud auth. The self-hosted
build replaces that with a local shim at `src/lib/amplify-shim/` — the user is
always "signed in" as `local@opentracy`, and the data hooks return empty
payloads for anything that was backed by AppSync (orgs, invites, credits,
API keys). Views that depend on cloud data render their empty state.

When wiring a real self-hosted auth backend, point those hooks at your API
instead of the shim — the shim is intentionally small so it's easy to replace.

## License

MIT. See [LICENSE](../LICENSE) in the repo root.
