"use client";

import { Component, useCallback, useEffect, useRef, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { ChatReplyWatcher, ReplyToasts, type ReplyToast } from "@/components/chat-replies";
import { AgentChatScreen, AgentDetailScreen, Agents } from "@/components/screens/agents";
import { LoginScreen, OnboardingScreen } from "@/components/screens/auth";
import { Dashboard } from "@/components/screens/dashboard";
import { Analytics } from "@/components/screens/analytics";
import { DefaultModel } from "@/components/screens/default-model";
import { CreateTask } from "@/components/screens/create-task";
import { CreateAgent, FileDetail, Models, MultiAgent, TaskDetail, Upload } from "@/components/screens/details";
import { Notifications } from "@/components/screens/notifications";
import { Devices } from "@/components/screens/devices";
import { OpenClaw } from "@/components/screens/openclaw";
import { Profile } from "@/components/screens/profile";
import { Security } from "@/components/screens/security";
import { WorkflowBuilder } from "@/components/screens/workflow";
import { Files } from "@/components/screens/files";
import { Mac } from "@/components/screens/mac";
import { ClaudeMcp } from "@/components/screens/mcp";
import { Settings, type Theme } from "@/components/screens/settings";
import { Tasks } from "@/components/screens/tasks";
import { Terminal } from "@/components/screens/terminal";
import { Trading } from "@/components/screens/trading";
import { Icon, useMedia, type IconName } from "@/components/ui/primitives";
import type { Nav, OverlayScreen, ScreenProps, TabId } from "@/lib/nav";
import { useNotifications } from "@/lib/notifications";
import { parsePath, toPath, type Route } from "@/lib/routes";

type Mode = "login" | "onboarding" | "app";

const TABS: { id: TabId; icon: IconName; label: string }[] = [
  { id: "dashboard", icon: "grid", label: "Home" },
  { id: "agents", icon: "robot", label: "Agents" },
  { id: "tasks", icon: "columns", label: "Tasks" },
  { id: "trading", icon: "chart", label: "Trade" },
  { id: "files", icon: "folder", label: "Files" },
  { id: "settings", icon: "gear", label: "Settings" },
];

function hexToRgb(h: string) {
  const m = h.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const OVERLAYS: Record<OverlayScreen, ComponentType<ScreenProps>> = {
    agentDetail: AgentDetailScreen, agentChat: AgentChatScreen, multiAgent: MultiAgent, terminal: Terminal, models: Models,
    openclaw: OpenClaw, mcp: ClaudeMcp, devices: Devices, workflow: WorkflowBuilder, notifications: Notifications,
    security: Security, analytics: Analytics, createAgent: CreateAgent, createTask: CreateTask,
    taskDetail: TaskDetail, fileDetail: FileDetail, upload: Upload, profile: Profile, defaultModel: DefaultModel,
};

const TAB_SCREENS: Record<Exclude<TabId, "settings">, ComponentType<ScreenProps>> = {
  dashboard: Dashboard, agents: Agents, tasks: Tasks, trading: Trading, files: Files, mac: Mac,
};

function renderOverlay(screen: OverlayScreen, nav: Nav) {
  const C = OVERLAYS[screen];
  return C ? <C nav={nav} /> : null;
}

function Sidebar({ tab, onTab, badges }: { tab: TabId; onTab: (t: TabId) => void; badges: Partial<Record<TabId, boolean>> }) {
  const item = (id: TabId, icon: IconName, label: string, on: boolean) => (
    <button key={id} className="tap" onClick={() => onTab(id)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, textAlign: "left", width: "100%",
      background: on ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent",
      color: on ? "var(--accent)" : "var(--text-dim)", fontWeight: on ? 680 : 560, fontSize: 14 }}>
      <Icon name={icon} size={20} stroke={on ? 2.2 : 1.9} fill={on ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "none"} />
      <span style={{ flex: 1 }}>{label}</span>
      {badges[id] && <span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--err)" }} />}
    </button>
  );
  return (
    <div className="sidebar glass" style={{ width: 236, flexShrink: 0, height: "100%", flexDirection: "column",
      borderRight: "1px solid var(--border)", borderTop: "none", borderBottom: "none", borderLeft: "none",
      padding: "calc(env(safe-area-inset-top, 0px) + 22px) 14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 8px 22px" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
          <Icon name="grid" size={19} stroke={2.2} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 760, letterSpacing: -0.4, whiteSpace: "nowrap" }}>Agent Command</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {TABS.map(t => item(t.id, t.icon, t.label, tab === t.id))}
      </div>
      <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        {item("mac", "monitor", "Mac Control", tab === "mac")}
      </div>
    </div>
  );
}

function BottomNav({ tab, onTab, badges }: { tab: TabId; onTab: (t: TabId) => void; badges: Partial<Record<TabId, boolean>> }) {
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 100, padding: "0 12px calc(10px + env(safe-area-inset-bottom, 12px))" }}>
      <div className="glass" style={{ display: "flex", borderRadius: 26, padding: "9px 6px 8px" }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} className="tap" onClick={() => onTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0", color: on ? "var(--accent)" : "var(--text-faint)" }}>
              <div style={{ position: "relative" }}>
                <Icon name={t.icon} size={22} stroke={on ? 2.2 : 1.9} fill={on ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "none"} />
                {badges[t.id] && <span style={{ position: "absolute", top: -1, right: -3, width: 8, height: 8, borderRadius: 4, background: "var(--err)", boxShadow: "0 0 0 2px var(--bg)" }} />}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: on ? 680 : 560, letterSpacing: -0.1 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("ac_nav") || "{}") as { mode?: Mode }; } catch { return {}; } })();
  const [mode, setMode] = useState<Mode>(saved.mode || "login");
  // The URL is the source of truth for which tab and screens are open
  const [route, setRoute] = useState<Route>(() => parsePath(location.pathname));
  const { tab, stack } = route;
  const [dark, setDark] = useState(() => { try { const s = localStorage.getItem("ac_dark"); return s === null ? true : s === "1"; } catch { return true; } });
  const applyDark = (v: boolean) => { setDark(v); try { localStorage.setItem("ac_dark", v ? "1" : "0"); } catch {} };
  const deviceRef = useRef<HTMLDivElement>(null);
  const accent = "#5b8cff";
  const isDesktop = useMedia("(min-width: 900px)");

  useEffect(() => { localStorage.setItem("ac_nav", JSON.stringify({ mode })); }, [mode]);

  // Every in-app navigation is a browser history entry, so the phone's back
  // button/gesture closes one screen at a time and links reopen the same screen.
  // history.state.depth counts entries we pushed, to tell whether "back" stays in the app.
  useEffect(() => {
    const canonical = toPath(parsePath(location.pathname));
    history.replaceState({ depth: history.state?.depth ?? 0 }, "", canonical);
    const onPop = () => setRoute(parsePath(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: Route, how: "push" | "replace") => {
    setRoute(next);
    const depth = (history.state?.depth ?? 0) as number;
    if (how === "push") history.pushState({ depth: depth + 1 }, "", toPath(next));
    else history.replaceState({ depth }, "", toPath(next));
  };

  useEffect(() => {
    const d = deviceRef.current; if (!d) return;
    d.style.setProperty("--accent", accent);
    d.style.setProperty("--accent-rgb", hexToRgb(accent));
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-rgb", hexToRgb(accent));
  }, [accent, mode, tab, stack]);

  const theme: Theme = dark ? "dark" : "light";
  const setTheme = (m: Theme) => applyDark(m === "dark");

  const nav: Nav = {
    params: stack.length ? stack[stack.length - 1].params || {} : {},
    push: (screen, params = {}) => {
      if (screen === "onboarding" || screen === "login") { setMode(screen); return; }
      navigate({ tab, stack: [...stack, { screen, params }] }, "push");
    },
    pop: () => {
      if (!stack.length) return;
      // Step back through history when the previous entry is ours; after a deep
      // link there is none, so swap in the parent screen instead of leaving the app
      if ((history.state?.depth ?? 0) > 0) history.back();
      else navigate({ tab, stack: stack.slice(0, -1) }, "replace");
    },
    go: (tb) => {
      setMode("app");
      if (tb !== tab || stack.length) navigate({ tab: tb, stack: [] }, "push");
    },
    openPath: (path) => { setMode("app"); navigate(parsePath(path), "push"); },
    replace: (target) => {
      if (target === "login" || target === "onboarding") { setMode(target); return; }
      setMode("app");
      navigate({ tab: target, stack: [] }, "replace");
    },
  };

  // Agent replies can land on any screen: announce them and link back to the chat
  const [toasts, setToasts] = useState<ReplyToast[]>([]);
  const chatRoute = (agentId: string): Route => ({
    tab: "agents",
    stack: [{ screen: "agentDetail", params: { id: agentId } }, { screen: "agentChat", params: { id: agentId } }],
  });
  const top = stack[stack.length - 1];
  const activeChatAgentId = top?.screen === "agentChat" ? top.params.id ?? null : null;
  const dismissToast = useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), []);

  // New notifications: a dot on Home (where the bell is) and a count in the browser tab title
  const { unseen } = useNotifications();
  const badges: Partial<Record<TabId, boolean>> = { dashboard: unseen.length > 0 };
  useEffect(() => { document.title = unseen.length ? `(${unseen.length}) Agent Command` : "Agent Command"; }, [unseen.length]);

  const TabScreen = TAB_SCREENS[tab as Exclude<TabId, "settings">];
  const overlay = stack.length ? stack[stack.length - 1] : null;

  return (
    <div className="device" data-theme={theme} ref={deviceRef}>
      <ChatReplyWatcher activeChatAgentId={activeChatAgentId} chatUrl={id => toPath(chatRoute(id))}
        onToast={t => setToasts(ts => [...ts.filter(x => x.agentId !== t.agentId), t])} />
      {mode === "app" && (
        <ReplyToasts toasts={toasts} onDismiss={dismissToast}
          onOpen={t => { dismissToast(t.id); setMode("app"); navigate(chatRoute(t.agentId), "push"); }} />
      )}
      {mode === "login" && <LoginScreen nav={nav} />}
      {mode === "onboarding" && <OnboardingScreen nav={nav} />}
      {mode === "app" && (isDesktop ? (
        <>
          <Sidebar tab={tab} onTab={nav.go} badges={badges} />
          <div style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, display: stack.length ? "none" : "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)" }}>
              <div className="content-wrap">
                {tab === "settings" ? <Settings nav={nav} theme={theme} setTheme={setTheme} /> : <TabScreen nav={nav} />}
              </div>
            </div>
            {overlay && (
              <div key={stack.length} style={{ position: "absolute", inset: 0, paddingTop: "env(safe-area-inset-top, 0px)", background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 60 }}>
                <div className="content-wrap">
                  {renderOverlay(overlay.screen, nav)}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", inset: 0, display: stack.length ? "none" : "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top, 0px)" }}>
            {tab === "settings" ? <Settings nav={nav} theme={theme} setTheme={setTheme} /> : <TabScreen nav={nav} />}
          </div>
          {overlay && (
            <div key={stack.length} style={{ position: "absolute", inset: 0, paddingTop: "env(safe-area-inset-top, 0px)", background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 60 }}>
              {renderOverlay(overlay.screen, nav)}
            </div>
          )}
          {!stack.length && <BottomNav tab={tab} onTab={nav.go} badges={badges} />}
        </>
      ))}
    </div>
  );
}

// Error boundary — a render crash shows a recovery screen instead of a blank page
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("App crashed:", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, padding: 32, background: "#0a0b10", color: "#f4f6fc", textAlign: "center",
        fontFamily: "-apple-system, system-ui, sans-serif" }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: "rgba(235,238,250,0.55)", maxWidth: 320, lineHeight: 1.5, wordBreak: "break-word" }}>
          {String(this.state.error.message || this.state.error)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => location.reload()}
            style={{ padding: "10px 22px", borderRadius: 100, border: "none", background: "#5b8cff", color: "#fff",
              fontSize: 14, fontWeight: 650, cursor: "pointer" }}>
            Reload
          </button>
          <button onClick={() => { try { localStorage.removeItem("ac_nav"); } catch {} location.reload(); }}
            style={{ padding: "10px 22px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.16)", background: "none",
              color: "rgba(235,238,250,0.62)", fontSize: 14, fontWeight: 650, cursor: "pointer" }}>
            Reset & reload
          </button>
        </div>
      </div>
    );
  }
}

export function AppRoot() {
  // Register the service worker for offline support / installability
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return <ErrorBoundary><App /></ErrorBoundary>;
}
