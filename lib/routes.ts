// URL <-> navigation state. Each tab has a path and each overlay screen adds a
// segment (plus its id, for screens about one item), e.g.
//   /settings/devices            Settings tab → Devices
//   /agents/agent/main/chat/main Agents tab → agent "main" → its chat
import type { NavParams, OverlayScreen, TabId } from "./nav";

export interface StackEntry { screen: OverlayScreen; params: NavParams }
export interface Route { tab: TabId; stack: StackEntry[] }

const TAB_PATH: Record<TabId, string> = {
  dashboard: "", agents: "agents", tasks: "tasks", trading: "trade", files: "files", mac: "mac", settings: "settings",
};

const SCREEN_SLUG: Record<OverlayScreen, string> = {
  agentDetail: "agent", agentChat: "chat", multiAgent: "multi-agent", terminal: "terminal", models: "models",
  openclaw: "openclaw", mcp: "claude-mcp", devices: "devices", workflow: "workflow", notifications: "notifications",
  security: "security", analytics: "analytics", createAgent: "new-agent", createTask: "new-task", taskDetail: "task",
  fileDetail: "file", upload: "upload", profile: "profile", defaultModel: "default-model",
};

// Screens about a single item carry its id as the next path segment
const TAKES_ID = new Set<OverlayScreen>(["agentDetail", "agentChat", "taskDetail", "fileDetail"]);

const TAB_BY_PATH = Object.fromEntries(Object.entries(TAB_PATH).map(([t, p]) => [p, t as TabId]));
const SCREEN_BY_SLUG = Object.fromEntries(Object.entries(SCREEN_SLUG).map(([s, slug]) => [slug, s as OverlayScreen]));

export function toPath({ tab, stack }: Route): string {
  const parts = [TAB_PATH[tab]];
  for (const { screen, params } of stack) {
    parts.push(SCREEN_SLUG[screen]);
    if (TAKES_ID.has(screen)) parts.push(encodeURIComponent(params.id ?? ""));
  }
  return "/" + parts.filter(Boolean).join("/");
}

// Unknown or malformed paths fall back to the nearest valid screen (ultimately Home)
export function parsePath(pathname: string): Route {
  const segs = pathname.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  let i = 0;
  let tab: TabId = "dashboard";
  if (segs[0] && TAB_BY_PATH[segs[0]]) tab = TAB_BY_PATH[segs[i++]];
  const stack: StackEntry[] = [];
  while (i < segs.length) {
    const screen = SCREEN_BY_SLUG[segs[i++]];
    if (!screen) break;
    if (TAKES_ID.has(screen)) {
      const id = segs[i++];
      if (!id) break;
      stack.push({ screen, params: { id } });
    } else {
      stack.push({ screen, params: {} });
    }
  }
  return { tab, stack };
}
