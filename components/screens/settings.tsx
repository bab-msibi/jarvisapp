"use client";

import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Avatar, Btn, Header, Icon, Pill, Row, Section, type IconName } from "@/components/ui/primitives";
import type { PushTarget, ScreenProps } from "@/lib/nav";

export type Theme = "light" | "dark";

interface SettingsRow { icon: IconName; color: string; title: string; sub: string; to?: PushTarget }

export function Settings({ nav, theme, setTheme }: ScreenProps & { theme: Theme; setTheme: (t: Theme) => void }) {
  const groups: { header: string; rows: SettingsRow[] }[] = [
    { header: "Account", rows: [
      { icon: "users", color: "var(--accent)", title: "Profile", sub: "Alex Pierce · Administrator", to: "profile" },
      { icon: "bell", color: "var(--purple)", title: "Notifications", sub: "Push, email, alerts" },
      { icon: "shield", color: "var(--ok)", title: "Security Center", sub: "MFA, devices, audit logs", to: "security" },
    ]},
    { header: "Server", rows: [
      { icon: "flow", color: "var(--accent)", title: "OpenClaw Integration", sub: "Connected · 192.168.1.24:8080", to: "openclaw" },
      { icon: "spark", color: "var(--warn)", title: "Claude MCP", sub: "Connect Claude Desktop & Claude Code", to: "mcp" },
      { icon: "lock", color: "var(--ok)", title: "Devices", sub: "Whitelist for remote access", to: "devices" },
      { icon: "key", color: "var(--warn)", title: "API Keys", sub: "4 keys · 1 expiring soon" },
      { icon: "network", color: "var(--cyan)", title: "Local Network", sub: "Remote access enabled" },
    ]},
    { header: "Mac Connection", rows: [
      { icon: "monitor", color: "var(--accent)", title: "Pair New Mac", sub: "Run setup wizard", to: "onboarding" },
      { icon: "link", color: "var(--ok)", title: "Test Connection", sub: "Last checked 2m ago" },
    ]},
    { header: "Agents", rows: [
      { icon: "brain", color: "var(--purple)", title: "Default Model", sub: "Qwen2.5-72B-Instruct" },
      { icon: "ram", color: "var(--cyan)", title: "Memory Limits", sub: "Per-agent: 8 GB" },
      { icon: "sliders", color: "var(--accent)", title: "Permissions", sub: "Tools, file access, network" },
    ]},
    { header: "Insights", rows: [
      { icon: "chart", color: "var(--accent)", title: "Analytics", sub: "Performance & cost", to: "analytics" },
    ]},
  ];
  return (
    <div className="screen pad-b anim-screen">
      <Header title="Settings" right={<ConnectionBadge />} />
      <OfflineBanner pageName="Settings" />
      <div className="pad">
        <button className="tap card" onClick={() => {}} style={{ width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 14, marginBottom: 18, textAlign: "left" }}>
          <Avatar name="Alex Pierce" color="slate" size={54} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>Alex Pierce</div><div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 2 }}>admin@agentcmd.io</div><Pill tone="info" style={{ marginTop: 7 }}><Icon name="shield" size={11} stroke={2.4} />Administrator</Pill></div>
          <Icon name="chevR" size={20} style={{ color: "var(--text-ghost)" }} />
        </button>
        <div className="card" style={{ padding: "4px 14px", marginBottom: 18 }}>
          <div className="between" style={{ padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)" }}><Icon name="moon" size={19} stroke={1.9} /></div>
              <div><div style={{ fontSize: 14.5, fontWeight: 580 }}>Appearance</div><div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 1 }}>{theme === "dark" ? "Dark" : "Light"} mode</div></div>
            </div>
            <div style={{ display: "flex", background: "var(--surface-2)", borderRadius: 100, padding: 3 }}>
              {(["light", "dark"] as const).map(m => (
                <button key={m} className="tap" onClick={() => setTheme(m)} style={{ padding: "6px 13px", borderRadius: 100, fontSize: 12.5, fontWeight: 620, textTransform: "capitalize",
                  background: theme === m ? "var(--accent)" : "transparent", color: theme === m ? "#fff" : "var(--text-faint)" }}>{m}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="settings-groups">
        {groups.map(g => (
          <div key={g.header} style={{ marginBottom: 18 }}>
            <Section title={g.header} />
            <div className="card" style={{ padding: "2px 14px" }}>
              {g.rows.map((r, i) => (
                <Row key={r.title} last={i === g.rows.length - 1} chev icon={r.icon} iconColor={r.color} iconBg="var(--surface-2)"
                  title={r.title} sub={r.sub} onClick={() => r.to && nav.push(r.to)} />
              ))}
            </div>
          </div>
        ))}
        </div>
        <Btn full variant="danger" icon="power" onClick={() => nav.replace("login")} style={{ marginTop: 4 }}>Sign out</Btn>
        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-ghost)", marginTop: 16 }}>Agent Command · v2.4.0 · Build 1182</p>
      </div>
    </div>
  );
}
