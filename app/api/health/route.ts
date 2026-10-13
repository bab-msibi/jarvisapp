import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Cheap liveness probe with no CLI dependency, so the UI can tell "server down"
// apart from "openclaw unavailable"
export const GET = handle(() => ({
  ok: true,
  uptimeSec: Math.floor(process.uptime()),
  pid: process.pid,
  timestamp: Date.now(),
}));
