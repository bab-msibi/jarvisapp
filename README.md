# Jarvis App

A local dashboard ("Agent Command") for [OpenClaw](https://openclaw.ai) agents running on this Mac, built with **Next.js 16**, **TypeScript** and **TanStack Query**. The app's API routes bridge to the `openclaw` CLI and to macOS system tools.

## Run

```sh
npm install
npm start          # builds, then serves http://127.0.0.1:3000
npm run dev        # development server with hot reload
npm run typecheck  # strict TypeScript check
```

### Run in the background

```sh
npm run service:install    # start at login, restart if it stops, keep the Mac awake on AC power
npm run service:status     # is it running / answering?
npm run service:restart    # pick up code changes (rebuilds only if the source changed)
npm run service:logs       # follow scripts/jarvis-server.log
npm run service:uninstall
```

The service is a launchd agent (`scripts/ai.jarvis.server.plist` → `scripts/jarvis-server.sh`). It holds a `caffeinate -s` assertion so the Mac doesn't sleep while plugged in; on battery it sleeps normally. Stop any manual `npm start` first — both use port 3000.

The server always binds to `127.0.0.1` (see the scripts in `package.json`). Keep it that way: the API runs shell commands and reads home-directory files, and remote access is meant to go only through the device-gated Cloudflare tunnel.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Server port |
| `OPENCLAW_BIN` | `openclaw` | Path to the OpenClaw CLI |

## Layout

- `app/` — the root layout and `app/api/*` route handlers.
- `app/[[...slug]]/page.tsx` — serves the app at every path; `lib/routes.ts` maps URLs to screens.
- `components/app-shell.tsx` — navigation shell (tabs + overlay stack synced to the URL and browser history), sidebar, bottom nav, error boundary.
- `components/screens/` — one module per screen; `components/ui/` — shared primitives and the connection badge.
- `lib/queries.ts` — TanStack Query hooks (`useData` polls the core endpoints every 15 s) and the raw → UI adapters.
- `lib/server/` — server-only code: OpenClaw CLI bridge, response cache, system stats, files, terminal, MCP setup, device whitelist.
- `lib/types.ts` — shared types; API response types are derived from the server functions.
- `proxy.ts` — runs before every request: device whitelist for tunneled traffic, JSON-only POSTs.
- `instrumentation.ts` — warms the CLI response cache on startup (the CLI has a ~15 s cold start).
- `pairing.html` — page shown to devices that aren't approved yet (served by `proxy.ts`, not publicly routable).
- `mcp-server.js` — standalone stdio MCP server exposing the API to Claude (`.mcp.json` registers it).
- `public/` — service worker, manifest, icons.

## URLs

Every screen has its own address, so the browser/phone back button closes one screen at a time and links reopen the same screen: tabs are `/`, `/agents`, `/tasks`, `/trade`, `/files`, `/mac`, `/settings`, and screens stack on top, e.g. `/settings/devices`, `/settings/openclaw/default-model`, `/agents/agent/main/chat/main`.

## Remote access

Requests that arrive through Cloudflare Tunnel (identified by Cloudflare's `cf-connecting-ip` / `cf-ray` headers) must carry a cookie for an approved device. New devices see a pairing code; approve it in **Settings → Devices**. The whitelist is stored hashed in `devices.json` (gitignored). Requests made directly on this Mac are always trusted.

## API

| Endpoint | Method | Source |
|---|---|---|
| `/api/health` | GET | Server liveness (no CLI) |
| `/api/status` | GET | `openclaw status --json` |
| `/api/agents` | GET | `openclaw agents list --json`, plus live `busy`: agents with a chat reply in progress |
| `/api/tasks` | GET | `openclaw tasks list --json` |
| `/api/sessions` | GET | `openclaw sessions list --json` |
| `/api/models` | GET | `openclaw models list` (parsed table) |
| `/api/cron` | GET | `openclaw cron list --json` |
| `/api/cron/runs` | GET | `?id=<job id>` → recent finished runs (status, output, model, tokens, delivery), newest first |
| `/api/cron/action` | POST | `{ id, action: "run" \| "enable" \| "disable" \| "model", model? }`; models must be in the chat allowlist |
| `/api/system` | GET | macOS system stats (`top`, `vm_stat`, `df`, `pmset`, `ioreg` for GPU load, …) plus `history`: CPU/RAM/GPU every 30s for the last 30 min, sampled in the background since the server started |
| `/api/files` | GET | Recent files in `~/Desktop`, `~/Downloads`, `~/Documents`, `~/Pictures` and the agent workspace. Params: `q`, `folder`, `type` (image/doc/code/media/archive), `sort` (recent/size/name), `limit`, `offset`, `content=1` (also match file contents: Spotlight, plus a direct read of the workspace's text files). The disk scan is cached for 30s |
| `/api/files/raw` | GET | Streams one file by `id` (inline for images/PDF/text, else download; `download=1` forces it). Ids resolving outside the indexed folders are refused |
| `/api/files/reveal` | POST | `{ id }` — selects the file in Finder. Local requests only |
| `/api/files/thumb` | GET | JPEG thumbnail for an image, PDF or video `id` (sips / Quick Look, cached in `~/Library/Caches/ai.jarvis/thumbs`) |
| `/api/files/upload` | PUT | Raw file body; `folder` (Workspace/Downloads/Desktop/Documents) and `name`. Max 100 MB, never overwrites |
| `/api/market` | GET | Simulated market data (paper trading) |
| `/api/mcp` | GET | Claude MCP install status and config |
| `/api/devices` | GET | Device whitelist |
| `/api/exec` | POST | `{ command }` → runs in a login shell; working directory persists |
| `/api/agent/chat` | POST | `{ agentId, message, sessionKey? }` → `openclaw agent` |
| `/api/agent/run` | POST | `{ prompt, agentId? }` → one `openclaw agent` turn (default agent when `agentId` is omitted); waits for the reply |
| `/api/digest` | GET / POST | GET: the latest daily digest (`digests/latest.md`) and any on-demand run. POST: regenerate now via `scripts/daily-digest.py` (~1 min) |
| `/api/mcp/install-desktop` | POST | Adds Jarvis to Claude Desktop's config (keeps a `.bak`) |
| `/api/devices/{request,approve,rename,remove}` | POST | Device pairing and whitelist management |

CLI-backed GET endpoints are cached in memory (10–30 s TTL). All POSTs must be `Content-Type: application/json`.

## Notes

- Chat history and the paper-trading portfolio live in the browser's `localStorage`.
