"use client";

import { ConnectionBadge, OfflineBanner } from "@/components/ui/connection";
import { Avatar, Btn, Header, Icon, Pill, Row, Section, type IconName } from "@/components/ui/primitives";
import type { PushTarget, ScreenProps } from "@/lib/nav";
import { useData, useGateway, useModelConfig, useWhoami } from "@/lib/queries";

export type Theme = "light" | "dark";

interface SettingsRow { icon: IconName; color: string; title: string; sub: string; to?: PushTarget }

export function Settings({ nav, theme, setTheme }: ScreenProps & { theme: Theme; setTheme: (t: Theme) => void }) {
  const { data: me } = useWhoami();
  const { data: gateway } = useGateway();
  const { data: modelCfg } = useModelConfig();
  const { status } = useData();
  const name = me?.mac.fullName ?? "…";
  const who = me ? (me.remote ? me.device?.name ?? "Remote device" : "This Mac") : "…";
  const defaultModel = modelCfg?.defaultModel ?? status?.sessions?.defaults?.model;
  const openclawSub = status?.runtimeVersion
    ? `OpenClaw ${status.runtimeVersion} · ${gateway ? (gateway.ok ? "gateway healthy" : "gateway down") : "checking…"}`
    : "Gateway, channels & schedules";
  const groups: { header: string; rows: SettingsRow[] }[] = [
    { header: "Account", rows: [
      { icon: "users", color: "var(--accent)", title: "Profile", sub: `${name} · ${who}`, to: "profile" },
      { icon: "bell", color: "var(--purple)", title: "Notifications", sub: "Push, email, alerts" },
      { icon: "shield", color: "var(--ok)", title: "Security Center", sub: "Tunnel, Cloudflare login & device checks", to: "security" },
    ]},
    { header: "Server", rows: [
      { icon: "flow", color: "var(--accent)", title: "OpenClaw Integration", sub: openclawSub, to: "openclaw" },
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
      { icon: "brain", color: "var(--purple)", title: "Default Model", sub: defaultModel ?? "…", to: "defaultModel" },
      { icon: "ram", color: "var(--cyan)", title: "Memory Limits", sub: "Per-agent: 8 GB" },
      { icon: "sliders", color: "var(--accent)", title: "Permissions", sub: "Tools, file access, network" },
    ]},
    { header: "Insights", rows: [
      { icon: "chart", color: "var(--accent)", title: "Analytics", sub: "Tokens, sessions & task outcomes", to: "analytics" },
    ]},
  ];
  return (
    <div className="screen pad-b anim-screen">
      <Header title="Settings" right={<ConnectionBadge />} />
      <OfflineBanner pageName="Settings" />
      <div className="pad">
        <button className="tap card" onClick={() => nav.push("profile")} style={{ width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 14, marginBottom: 18, textAlign: "left" }}>
          <Avatar name={name} color="slate" size={54} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>{name}</div><div className="clip" style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 2 }}>{me?.email || (me ? `${me.mac.username}@${me.mac.hostname}` : "…")}</div><Pill tone={me?.remote ? "purple" : "ok"} style={{ marginTop: 7 }}><Icon name={me?.remote ? "globe" : "monitor"} size={11} stroke={2.4} />{who}</Pill></div>
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
        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-ghost)", marginTop: 16 }}>Jarvis {me?.appVersion ?? "…"} · OpenClaw {status?.runtimeVersion ?? "…"}</p>
      </div>
    </div>
  );
}
