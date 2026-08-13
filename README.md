# Jarvis App

A local PWA dashboard ("Agent Command") for [OpenClaw](https://openclaw.ai) agents running on this Mac. Single-file React frontend served by a zero-dependency Node server that bridges to the `openclaw` CLI.

## Run

```sh
npm start          # or: node server.js
```

Then open http://127.0.0.1:3000. Configurable via environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `127.0.0.1` | Bind address (keep loopback — the API shells out to the CLI and reads local files) |
| `OPENCLAW_BIN` | `openclaw` | Path to the OpenClaw CLI |

## Files

- `server.js` — HTTP server: static files + `/api/*` bridge to the `openclaw` CLI, with in-memory response caching (the CLI has a ~15 s cold start).
- `index.html` — the entire frontend (React 18 + Babel standalone from CDN, JSX inline).
- `sw.js` — service worker: network-first with offline cache fallback.
- `manifest.json`, `icon*` — PWA install metadata.

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
| `/api/files` | GET | Recent files in `~/Desktop`, `~/Downloads`, `~/Documents`, `~/Pictures`, and the agent workspace. Params: `q`, `folder`, `limit` |
| `/api/market` | GET | Simulated market data (paper trading) |
| `/api/agent/chat` | POST | `{ agentId, message, sessionKey? }` → `openclaw agent` |
| `/api/agent/run` | POST | `{ prompt, agentId? }` → `openclaw agent` |

GET endpoints are cached in memory (10–30 s TTL); parameterised requests bypass the cache.

## Notes

- The server binds to loopback only by default — it executes the CLI and lists home-directory files, so don't expose it on the network without adding auth.
- Chat history is stored in the browser's `localStorage` (last 50 sessions per agent).
