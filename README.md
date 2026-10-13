# Jarvis App

A local dashboard ("Agent Command") for [OpenClaw](https://openclaw.ai) agents running on this Mac, built with **Next.js 16**, **TypeScript** and **TanStack Query**. The app's API routes bridge to the `openclaw` CLI and to macOS system tools.

## Run

```sh
npm install
npm start          # builds, then serves http://127.0.0.1:3000
npm run dev        # development server with hot reload
npm run typecheck  # strict TypeScript check
```

The server always binds to `127.0.0.1` (see the scripts in `package.json`). Keep it that way: the API runs shell commands and reads home-directory files, and remote access is meant to go only through the device-gated Cloudflare tunnel.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Server port |
| `OPENCLAW_BIN` | `openclaw` | Path to the OpenClaw CLI |

## Layout

- `app/` — the root layout, the page, and `app/api/*` route handlers.
- `components/app-shell.tsx` — navigation shell (tabs + overlay stack), sidebar, bottom nav, error boundary.
- `components/screens/` — one module per screen; `components/ui/` — shared primitives and the connection badge.
- `lib/queries.ts` — TanStack Query hooks (`useData` polls the core endpoints every 15 s) and the raw → UI adapters.
- `lib/server/` — server-only code: OpenClaw CLI bridge, response cache, system stats, files, terminal, MCP setup, device whitelist.
- `lib/types.ts` — shared types; API response types are derived from the server functions.
- `proxy.ts` — runs before every request: device whitelist for tunneled traffic, JSON-only POSTs.
- `instrumentation.ts` — warms the CLI response cache on startup (the CLI has a ~15 s cold start).
- `pairing.html` — page shown to devices that aren't approved yet (served by `proxy.ts`, not publicly routable).
- `mcp-server.js` — standalone stdio MCP server exposing the API to Claude (`.mcp.json` registers it).
- `public/` — service worker, manifest, icons.

## Remote access

Requests that arrive through Cloudflare Tunnel (identified by Cloudflare's `cf-connecting-ip` / `cf-ray` headers) must carry a cookie for an approved device. New devices see a pairing code; approve it in **Settings → Devices**. The whitelist is stored hashed in `devices.json` (gitignored). Requests made directly on this Mac are always trusted.

## API

| Endpoint | Method | Source |
|---|---|---|
| `/api/health` | GET | Server liveness (no CLI) |
| `/api/status` | GET | `openclaw status --json` |
| `/api/agents` | GET | `openclaw agents list --json` |
| `/api/tasks` | GET | `openclaw tasks list --json` |
| `/api/sessions` | GET | `openclaw sessions list --json` |
| `/api/models` | GET | `openclaw models list` (parsed table) |
| `/api/cron` | GET | `openclaw cron list --json` |
| `/api/system` | GET | macOS system stats (`top`, `vm_stat`, `df`, `pmset`, …) |
| `/api/files` | GET | Recent files in `~/Desktop`, `~/Downloads`, `~/Documents`, `~/Pictures` and the agent workspace. Params: `q`, `folder`, `limit` |
| `/api/market` | GET | Simulated market data (paper trading) |
| `/api/mcp` | GET | Claude MCP install status and config |
| `/api/devices` | GET | Device whitelist |
| `/api/exec` | POST | `{ command }` → runs in a login shell; working directory persists |
| `/api/agent/chat` | POST | `{ agentId, message, sessionKey? }` → `openclaw agent` |
| `/api/agent/run` | POST | `{ prompt, agentId? }` → `openclaw agent` |
| `/api/mcp/install-desktop` | POST | Adds Jarvis to Claude Desktop's config (keeps a `.bak`) |
| `/api/devices/{request,approve,rename,remove}` | POST | Device pairing and whitelist management |

CLI-backed GET endpoints are cached in memory (10–30 s TTL). All POSTs must be `Content-Type: application/json`.

## Notes

- Chat history and the paper-trading portfolio live in the browser's `localStorage`.
