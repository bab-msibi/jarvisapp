"use client";

import { Fragment } from "react";
import { StatTile } from "@/components/screens/dashboard";
import { Avatar, Bar, Btn, Dot, GhostBtn, Icon, Pill, Ring, Row, Section, Sparkline, TopBar, MiniBars, type IconName, type Tone } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";

export function OpenClaw({ nav }: ScreenProps) {
  const workflows = [
    { name: "Nightly Data Sync", status: "running", steps: 6, agent: "Automation" },
    { name: "Build Fitness App", status: "running", steps: 9, agent: "Manager +4" },
    { name: "Deploy Staging", status: "failed", steps: 5, agent: "Automation" },
  ];
  const tools = ["Web Search", "Code Exec", "File I/O", "Shell", "HTTP API", "RAG Query", "Vision", "Email"];
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="OpenClaw" sub="Orchestration engine" right={<GhostBtn icon="dots" size={38} onClick={() => {}} />} />
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="between">
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--ok-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ok)" }}><Icon name="flow" size={22} stroke={1.8} /></div>
              <div><div style={{ fontSize: 15, fontWeight: 680 }}>Connected</div><div className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>192.168.1.24:8080 · v2.4</div></div>
            </div>
            <Dot pulse size={9} />
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            {[["7", "Agents"], ["2", "Workflows"], ["8", "Tools"], ["99.9%", "Uptime"]].map(([v, l]) => (
              <div key={l}><div style={{ fontSize: 17, fontWeight: 740, letterSpacing: -0.4 }}>{v}</div><div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>{l}</div></div>
            ))}
          </div>
        </div>
        <Btn full icon="flow" onClick={() => nav.push("workflow")} style={{ marginBottom: 18 }}>Open Workflow Builder</Btn>
        <Section title="Running workflows" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          {workflows.map((w, i) => (
            <Row key={w.name} last={i === workflows.length - 1} icon={w.status === "failed" ? "x" : "flow"} iconColor={w.status === "failed" ? "var(--err)" : "var(--accent)"} iconBg="var(--surface-2)"
              title={w.name} sub={`${w.steps} steps · ${w.agent}`}
              right={<Pill tone={w.status === "failed" ? "err" : "ok"}>{w.status === "running" && <Dot size={5} color="var(--ok)" pulse />}{w.status}</Pill>} />
          ))}
        </div>
        <Section title="Tool configuration" />
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tools.map((t, i) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 100, fontSize: 12, fontWeight: 580,
                background: i < 6 ? "rgba(var(--accent-rgb),0.14)" : "var(--surface-2)", color: i < 6 ? "var(--accent)" : "var(--text-faint)" }}>
                <Dot size={6} color={i < 6 ? "var(--accent)" : "var(--text-ghost)"} />{t}
              </span>
            ))}
          </div>
        </div>
        <Section title="Event log" />
        <div className="card mono" style={{ padding: 14, fontSize: 11.5, lineHeight: 1.9 }}>
          {[["10:34:02", "task.completed", "var(--ok)"], ["10:34:08", "file.created", "var(--accent)"], ["10:33:51", "agent.spawned", "var(--purple)"], ["10:31:20", "workflow.failed", "var(--err)"]].map(([t, e, c]) => (
            <div key={t} style={{ display: "flex", gap: 10 }}><span style={{ color: "var(--text-ghost)" }}>{t}</span><span style={{ color: c }}>{e}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkflowBuilder({ nav }: ScreenProps) {
  const nodes: { icon: IconName; label: string; sub: string; tone: string }[] = [
    { icon: "bolt", label: "Trigger", sub: "Schedule · 2:00 AM daily", tone: "amber" },
    { icon: "search", label: "Web Search", sub: "Gather latest market data", tone: "cyan" },
    { icon: "robot", label: "Research Agent", sub: "Qwen2.5-72B", tone: "blue" },
    { icon: "code", label: "Code Execution", sub: "Transform → CSV", tone: "purple" },
    { icon: "shield", label: "Approval", sub: "Wait for human review", tone: "warn" },
    { icon: "bell", label: "Notification", sub: "Push when complete", tone: "info" },
  ];
  const palette: { icon: IconName; label: string }[] = [
    { icon: "bolt", label: "Trigger" }, { icon: "robot", label: "Agent" }, { icon: "brain", label: "Model" },
    { icon: "search", label: "Search" }, { icon: "code", label: "Code" }, { icon: "doc", label: "File" },
    { icon: "globe", label: "API" }, { icon: "bell", label: "Notify" }, { icon: "shield", label: "Approval" },
  ];
  const tc = (t: string) => ({ amber: "var(--warn)", cyan: "var(--cyan)", blue: "var(--accent)", purple: "var(--purple)", warn: "var(--warn)", info: "var(--accent)" } as Record<string, string>)[t];
  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Workflow Builder" sub="Nightly Data Sync" right={<Btn size="sm" icon="play" onClick={nav.pop} style={{ borderRadius: 11 }}>Run</Btn>} />
      <div className="screen" style={{ flex: 1, padding: "10px 18px 16px", backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {nodes.map((n, i) => (
            <Fragment key={i}>
              <div className="card" style={{ padding: 13, width: "100%", maxWidth: 280, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-solid)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in oklab, ${tc(n.tone)} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: tc(n.tone), flexShrink: 0 }}><Icon name={n.icon} size={20} stroke={2} /></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 660 }}>{n.label}</div><div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }} className="clip">{n.sub}</div></div>
                <Icon name="dots" size={18} style={{ color: "var(--text-ghost)" }} />
              </div>
              {i < nodes.length - 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: 26 }}>
                  <div style={{ width: 2, flex: 1, background: "var(--border-strong)" }} />
                  <Icon name="chevD" size={14} style={{ color: "var(--text-ghost)", marginTop: -4 }} />
                </div>
              )}
            </Fragment>
          ))}
          <div style={{ width: 2, height: 16, background: "var(--border-strong)" }} />
          <button className="tap" style={{ width: 38, height: 38, borderRadius: 12, border: "1.5px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)" }}><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: "10px 0 14px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ fontSize: 11, fontWeight: 680, color: "var(--text-faint)", letterSpacing: 0.4, padding: "0 18px 9px" }}>DRAG A BLOCK TO ADD</div>
        <div style={{ display: "flex", gap: 9, overflowX: "auto", padding: "0 18px", scrollbarWidth: "none" }}>
          {palette.map(p => (
            <div key={p.label} className="tap card" style={{ flexShrink: 0, padding: "10px 13px", display: "flex", alignItems: "center", gap: 7 }}>
              <Icon name={p.icon} size={16} style={{ color: "var(--accent)" }} stroke={2} /><span style={{ fontSize: 12.5, fontWeight: 580 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Security({ nav }: ScreenProps) {
  const devices: { name: string; sub: string; icon: IconName; ok: boolean }[] = [
    { name: "iPhone 16 Pro", sub: "This device · Cupertino", icon: "monitor", ok: true },
    { name: "MacBook Pro M4", sub: "Trusted · 2h ago", icon: "monitor", ok: true },
    { name: "Unknown · Chrome", sub: "Blocked · 192.41.x.x", icon: "globe", ok: false },
  ];
  const logins = [
    { t: "Successful login", time: "Today 10:24", loc: "Cupertino, CA", ok: true },
    { t: "MFA challenge passed", time: "Today 10:24", loc: "iPhone 16 Pro", ok: true },
    { t: "Failed login attempt", time: "Yesterday 23:11", loc: "Unknown IP", ok: false },
  ];
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Security Center" sub="Enterprise-grade" right={<GhostBtn icon="shield" size={38} onClick={() => {}} />} />
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <Ring value={92} size={74} stroke={7} color="var(--ok)" label="92" sub="SCORE" />
          <div style={{ flex: 1 }}><div style={{ fontSize: 15.5, fontWeight: 700 }}>Strong protection</div><div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.4 }}>MFA active · E2E encrypted · 1 device needs review</div></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          {([["MFA", "Enabled", "ok", "key"], ["Sessions", "3 active", "info", "users"]] as [string, string, Tone, IconName][]).map(([l, v, t, ic]) => (
            <div key={l} className="card" style={{ padding: 14, flex: 1 }}>
              <Icon name={ic} size={18} style={{ color: t === "ok" ? "var(--ok)" : "var(--accent)" }} stroke={2} />
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 9 }}>{v}</div><div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>{l}</div>
            </div>
          ))}
        </div>
        <Section title="Role-based access" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          {[["Administrator", "Full access · 1 user", "var(--accent)"], ["Operator", "Agents & tasks · 3 users", "var(--purple)"], ["Viewer", "Read-only · 5 users", "var(--text-dim)"]].map(([r, s, c], i) => (
            <Row key={r} last={i === 2} icon="users" iconColor={c} iconBg="var(--surface-2)" title={r} sub={s} chev onClick={() => {}} />
          ))}
        </div>
        <Section title="Device authorization" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 18 }}>
          {devices.map((d, i) => (
            <Row key={d.name} last={i === devices.length - 1} icon={d.icon} iconColor={d.ok ? "var(--ok)" : "var(--err)"} iconBg="var(--surface-2)"
              title={d.name} sub={d.sub} right={<Pill tone={d.ok ? "ok" : "err"}>{d.ok ? "Trusted" : "Blocked"}</Pill>} />
          ))}
        </div>
        <Section title="Login history & audit log" />
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          {logins.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 11, padding: "9px 0", borderBottom: i < logins.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: l.ok ? "var(--ok-soft)" : "var(--err-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: l.ok ? "var(--ok)" : "var(--err)", flexShrink: 0 }}><Icon name={l.ok ? "check" : "x"} size={15} stroke={2.4} /></div>
              <div style={{ flex: 1 }}><div className="between"><span style={{ fontSize: 13, fontWeight: 580 }}>{l.t}</span><span style={{ fontSize: 11, color: "var(--text-ghost)" }}>{l.time}</span></div><div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>{l.loc}</div></div>
            </div>
          ))}
        </div>
        <Section title="API key management" />
        <div className="card" style={{ padding: "2px 14px" }}>
          {[["Production key", "sk-…a4f2 · created Jan 2025", "ok"], ["CI/CD key", "sk-…91be · expires in 4 days", "warn"]].map(([n, s, t], i) => (
            <Row key={n} last={i === 1} icon="key" iconColor={t === "warn" ? "var(--warn)" : "var(--text-dim)"} iconBg="var(--surface-2)" title={n} sub={s} right={<Icon name="dots" size={18} style={{ color: "var(--text-ghost)" }} />} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Analytics({ nav }: ScreenProps) {
  const perf = [
    { name: "Coding Agent", color: "purple", val: 94, tasks: 142 },
    { name: "Research Agent", color: "blue", val: 88, tasks: 98 },
    { name: "Support Agent", color: "cyan", val: 81, tasks: 211 },
    { name: "Automation Agent", color: "amber", val: 76, tasks: 64 },
  ];
  const models: [string, number, string][] = [["Qwen2.5-72B", 96, "var(--accent)"], ["DeepSeek-V3", 91, "var(--purple)"], ["Mistral-Large", 84, "var(--cyan)"], ["Llama-3.3", 79, "var(--ok)"]];
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Analytics" sub="Last 7 days" right={<GhostBtn icon="calendar" size={38} onClick={() => {}} />} />
      <div className="pad">
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <StatTile icon="check" label="Tasks done" value="318" tone="ok" spark={[12,18,15,22,19,26,24]} />
          <StatTile icon="clock" label="Avg time" value="4.2m" tone="info" spark={[8,6,7,5,5,4,4]} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <StatTile icon="bolt" label="Tokens" value="14.2M" tone="purple" spark={[3,4,3,5,6,5,7]} />
          <StatTile icon="chart" label="Cost saved" value="$2,840" tone="cyan" spark={[2,3,4,4,5,6,7]} />
        </div>
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="between" style={{ marginBottom: 14 }}><span style={{ fontSize: 14, fontWeight: 660 }}>Tasks completed</span><Pill tone="ok"><Icon name="arrowU" size={11} stroke={2.4} />+18%</Pill></div>
          <Sparkline data={[24, 31, 28, 42, 38, 52, 47, 58]} color="var(--accent)" w={300} h={70} />
          <div className="between" style={{ marginTop: 8 }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d} style={{ fontSize: 10, color: "var(--text-ghost)" }}>{d}</span>)}</div>
        </div>
        <Section title="Agent performance" />
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          {perf.map((p, i) => (
            <div key={p.name} style={{ marginBottom: i < perf.length - 1 ? 14 : 0 }}>
              <div className="between" style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={p.name} color={p.color} size={22} /><span style={{ fontSize: 13, fontWeight: 580 }}>{p.name}</span></div>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}><span className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{p.val}%</span> · {p.tasks} tasks</span>
              </div>
              <Bar value={p.val} color={`var(--${p.color === "blue" ? "accent" : p.color})`} h={6} />
            </div>
          ))}
        </div>
        <Section title="Model comparison" />
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          {models.map(([n, v, c], i) => (
            <div key={n} style={{ marginBottom: i < models.length - 1 ? 13 : 0 }}>
              <div className="between" style={{ marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 540 }}>{n}</span><span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{v}% quality</span></div>
              <Bar value={v} color={c} h={6} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="card" style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Ring value={68} size={76} stroke={7} color="var(--purple)" label="68%" sub="AVG GPU" />
            <span style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10 }}>Resource use</span>
          </div>
          <div className="card" style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
            <div><div style={{ fontSize: 20, fontWeight: 760, letterSpacing: -0.5 }}>14.2M</div><div style={{ fontSize: 11, color: "var(--text-faint)" }}>Tokens used</div></div>
            <MiniBars data={[3, 4, 3, 5, 6, 5, 7]} color="var(--cyan)" w={110} h={30} />
            <div style={{ fontSize: 11.5, color: "var(--ok)", fontWeight: 600 }}>$0 API cost · all local</div>
          </div>
        </div>
      </div>
    </div>
  );
}
