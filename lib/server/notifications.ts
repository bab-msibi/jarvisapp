// Things that need attention, gathered from the device whitelist, OpenClaw and
// the tunnel. Each item has a stable id (so the app can remember what you've
// already seen) and a link to the screen where you can act on it.
import * as devices from "./devices";
import { getCached } from "./endpoints";

export interface Notification {
  id: string;
  severity: "err" | "warn" | "info";
  icon: "lock" | "warn" | "clock" | "message" | "network" | "flow";
  title: string;
  text: string;
  at: number;
  link: string; // app path, e.g. /settings/devices
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

interface RawTaskLite { taskId: string; status: string; label?: string; task?: string; error?: string; endedAt?: number; terminalSummary?: string }
interface RawCronLite {
  id: string; name: string; enabled?: boolean;
  delivery?: { mode?: string; channel?: string };
  state?: { lastRunAtMs?: number; lastRunStatus?: string; lastError?: string; consecutiveErrors?: number; lastDeliveryStatus?: string };
}

const settle = <T,>(p: Promise<T>) => p.then((v) => v, () => null);

export async function notifications(): Promise<Notification[]> {
  const items: Notification[] = [];
  const now = Date.now();

  for (const d of devices.list(null).filter((x) => x.status === "pending")) {
    items.push({
      id: `device:${d.id}`, severity: "warn", icon: "lock",
      title: "Device waiting for approval",
      text: `${d.name}${d.email ? ` · ${d.email}` : ""} · code ${d.code}`,
      at: d.createdAt, link: "/settings/devices",
    });
  }

  const [tasks, cron, gateway, tunnel] = await Promise.all([
    settle(getCached("tasks") as Promise<{ tasks?: RawTaskLite[] }>),
    settle(getCached("cron") as Promise<{ jobs?: RawCronLite[] }>),
    settle(getCached("gateway")),
    settle(getCached("tunnel")),
  ]);

  for (const t of tasks?.tasks ?? []) {
    if (!["failed", "timed_out", "lost"].includes(t.status) || !t.endedAt || now - t.endedAt > WEEK) continue;
    const what = (t.label || t.task || t.taskId).replace(/^\[[^\]]*\]\s*/, "").slice(0, 90);
    items.push({
      id: `task:${t.taskId}`, severity: "err", icon: "warn",
      title: t.status === "timed_out" ? "Task timed out" : t.status === "lost" ? "Task lost" : "Task failed",
      text: t.error ? `${what} — ${t.error.slice(0, 120)}` : what,
      at: t.endedAt, link: "/tasks",
    });
  }

  for (const j of cron?.jobs ?? []) {
    const s = j.state ?? {};
    if (j.enabled === false || !s.lastRunAtMs) continue;
    if (s.lastRunStatus === "error") {
      items.push({
        id: `cron-error:${j.id}:${s.lastRunAtMs}`, severity: "err", icon: "clock",
        title: `Scheduled job failed${(s.consecutiveErrors ?? 0) > 1 ? ` ${s.consecutiveErrors}× in a row` : ""}`,
        text: s.lastError ? `${j.name} — ${s.lastError.slice(0, 120)}` : j.name,
        at: s.lastRunAtMs, link: "/settings/openclaw",
      });
    } else if (s.lastDeliveryStatus === "not-delivered" && j.delivery?.mode && j.delivery.mode !== "none") {
      items.push({
        id: `cron-delivery:${j.id}:${s.lastRunAtMs}`, severity: "warn", icon: "clock",
        title: "Scheduled job ran but wasn't delivered",
        text: `${j.name} — not posted to ${j.delivery.channel ? j.delivery.channel[0].toUpperCase() + j.delivery.channel.slice(1) : "its channel"}`,
        at: s.lastRunAtMs, link: "/settings/openclaw",
      });
    }
  }

  if (gateway) {
    if (gateway.degraded) {
      items.push({ id: "gateway:degraded", severity: "warn", icon: "flow", title: "OpenClaw gateway is degraded", text: gateway.degradedReasons.join(", ") || "Check `openclaw doctor`", at: now, link: "/settings/openclaw" });
    }
    for (const c of gateway.channels.filter((c) => c.enabled && !c.connected)) {
      items.push({
        id: `channel:${c.name}:down`, severity: "err", icon: "message",
        title: `${c.name[0].toUpperCase()}${c.name.slice(1)} is offline`,
        text: c.lastError ?? `${c.botName ?? "The bot"} isn't connected`,
        at: now, link: "/settings/openclaw",
      });
    }
  }

  if (tunnel?.configured) {
    if (!tunnel.running) {
      items.push({ id: "tunnel:down", severity: "err", icon: "network", title: "Remote access is down", text: "cloudflared isn't running — Jarvis can't be reached from your phone", at: tunnel.checkedAt, link: "/settings/security" });
    } else if (!tunnel.accessProtected) {
      items.push({ id: "tunnel:no-access", severity: "err", icon: "network", title: "Cloudflare login missing", text: `${tunnel.hostname} isn't behind Cloudflare Access`, at: tunnel.checkedAt, link: "/settings/security" });
    }
  }

  return items.sort((a, b) => b.at - a.at);
}
