"use client";

import { Component, useEffect, useRef, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { Agents } from "@/components/screens/agents";
import { LoginScreen, OnboardingScreen } from "@/components/screens/auth";
import { Dashboard } from "@/components/screens/dashboard";
import { Analytics } from "@/components/screens/analytics";
import { DefaultModel } from "@/components/screens/default-model";
import { AgentChatLegacy, CreateAgent, CreateTask, FileDetail, Models, MultiAgent, Notifications, TaskDetail, Upload } from "@/components/screens/details";
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
import type { Nav, NavParams, OverlayScreen, ScreenProps, TabId } from "@/lib/nav";

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
    agentChat: AgentChatLegacy, multiAgent: MultiAgent, terminal: Terminal, models: Models,
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

function Sidebar({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  const item = (id: TabId, icon: IconName, label: string, on: boolean) => (
    <button key={id} className="tap" onClick={() => onTab(id)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, textAlign: "left", width: "100%",
      background: on ? "color-mix(in oklab, var(--accent) 14%, transparent)" : "transparent",
      color: on ? "var(--accent)" : "var(--text-dim)", fontWeight: on ? 680 : 560, fontSize: 14 }}>
      <Icon name={icon} size={20} stroke={on ? 2.2 : 1.9} fill={on ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "none"} />
      <span>{label}</span>
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

function BottomNav({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 100, padding: "0 12px calc(10px + env(safe-area-inset-bottom, 12px))" }}>
      <div className="glass" style={{ display: "flex", borderRadius: 26, padding: "9px 6px 8px" }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} className="tap" onClick={() => onTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0", color: on ? "var(--accent)" : "var(--text-faint)" }}>
              <div style={{ position: "relative" }}>
                <Icon name={t.icon} size={22} stroke={on ? 2.2 : 1.9} fill={on ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "none"} />
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
  const saved = (() => { try { return JSON.parse(localStorage.getItem("ac_nav") || "{}") as { mode?: Mode; tab?: TabId }; } catch { return {}; } })();
  const [mode, setMode] = useState<Mode>(saved.mode || "login");
  const [tab, setTab] = useState<TabId>(saved.tab || "dashboard");
  const [stack, setStack] = useState<{ screen: OverlayScreen; params: NavParams }[]>([]);
  const [dark, setDark] = useState(() => { try { const s = localStorage.getItem("ac_dark"); return s === null ? true : s === "1"; } catch { return true; } });
  const applyDark = (v: boolean) => { setDark(v); try { localStorage.setItem("ac_dark", v ? "1" : "0"); } catch {} };
  const deviceRef = useRef<HTMLDivElement>(null);
  const accent = "#5b8cff";
  const isDesktop = useMedia("(min-width: 900px)");

  useEffect(() => { localStorage.setItem("ac_nav", JSON.stringify({ mode, tab })); }, [mode, tab]);

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
      if (screen === "onboarding") { setMode("onboarding"); setStack([]); return; }
      if (screen === "login") { setMode("login"); setStack([]); return; }
      setStack(s => [...s, { screen, params }]);
    },
    pop: () => setStack(s => s.slice(0, -1)),
    go: (tb) => { setMode("app"); setTab(tb); setStack([]); },
    replace: (target) => {
      setStack([]);
      if (target === "login") setMode("login");
      else if (target === "onboarding") setMode("onboarding");
      else { setMode("app"); setTab(target); }
    },
  };

  const TabScreen = TAB_SCREENS[tab as Exclude<TabId, "settings">];
  const overlay = stack.length ? stack[stack.length - 1] : null;

  return (
    <div className="device" data-theme={theme} ref={deviceRef}>
      {mode === "login" && <LoginScreen nav={nav} />}
      {mode === "onboarding" && <OnboardingScreen nav={nav} />}
      {mode === "app" && (isDesktop ? (
        <>
          <Sidebar tab={tab} onTab={nav.go} />
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
          {!stack.length && <BottomNav tab={tab} onTab={nav.go} />}
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
