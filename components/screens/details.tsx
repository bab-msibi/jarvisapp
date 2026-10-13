"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Field } from "@/components/screens/auth";
import { AGENT_GRAD, Avatar, Bar, Btn, Dot, GhostBtn, Icon, MD, Pill, Row, Section, Sheet, TopBar, type AgentColor, type IconName, type Tone } from "@/components/ui/primitives";
import { AGENTS, CHAT, COL_TONE, FILE_TONE, FILES, MODELS, NOTIFS, TASK_COLS, TASKS, type MockTask, type TaskCol } from "@/lib/mock-data";
import type { Nav, ScreenProps } from "@/lib/nav";
import { useData } from "@/lib/queries";
import type { Model } from "@/lib/types";

const TONE_COLOR: Partial<Record<Tone, string>> = { ok: "var(--ok)", warn: "var(--warn)", err: "var(--err)", purple: "var(--purple)", cyan: "var(--cyan)", info: "var(--accent)", neutral: "var(--text-dim)" };

export function AgentChatLegacy({ nav }: ScreenProps) {
  const a = AGENTS.find(x => x.id === nav.params.id) || AGENTS[0];
  const [sheet, setSheet] = useState<"controls" | null>(null);
  const [memOpen, setMemOpen] = useState(false);
  const col = `var(--${a.color === "blue" ? "accent" : a.color})`;
  const controls: { icon: IconName; label: string; tone: Tone }[] = [
    { icon: a.status === "paused" ? "play" : "pause", label: a.status === "paused" ? "Resume" : "Pause", tone: a.status === "paused" ? "ok" : "warn" },
    { icon: "stop", label: "Stop", tone: "err" }, { icon: "brain", label: "Change Model", tone: "purple" },
    { icon: "sliders", label: "Assign Tools", tone: "cyan" }, { icon: "flag", label: "Set Priority", tone: "info" },
  ];
  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop}
        right={<div style={{ display: "flex", gap: 7 }}><GhostBtn icon="brain" size={38} onClick={() => setMemOpen(true)} /><GhostBtn icon="dots" size={38} onClick={() => setSheet("controls")} /></div>}
        title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={a.name} color={a.color} icon={a.icon} size={26} />{a.name}</span>}
        sub={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Dot size={5} color={col} pulse={a.status === "running"} />{a.status} · {a.model}</span>} />
      <div className="screen" style={{ padding: "8px 16px 16px", flex: 1 }}>
        {CHAT.map(m => {
          if (m.type === "typing") return (
            <div key={m.id} style={{ display: "flex", gap: 9, marginBottom: 14 }}>
              <Avatar name={a.name} color={a.color} icon={a.icon} size={28} />
              <div className="card" style={{ padding: "13px 15px", borderRadius: "4px 16px 16px 16px", display: "flex", gap: 5 }}>
                {[0, 1, 2].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: 4, background: "var(--text-faint)", animation: `pulse 1.2s infinite`, animationDelay: `${d * 0.18}s` }} />)}
              </div>
            </div>
          );
          if (m.from === "user") return (
            <div key={m.id} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <div style={{ maxWidth: "78%", background: "var(--accent)", color: "#fff", padding: "11px 14px", borderRadius: "16px 16px 4px 16px", fontSize: 14, lineHeight: 1.45, }}>{m.text}</div>
            </div>
          );
          return (
            <div key={m.id} style={{ display: "flex", gap: 9, marginBottom: 14 }}>
              <Avatar name={a.name} color={a.color} icon={a.icon} size={28} />
              <div style={{ maxWidth: "82%", minWidth: 0 }}>
                {m.type === "task" ? (
                  <div className="card" style={{ padding: 13, borderRadius: "4px 16px 16px 16px" }}>
                    <div className="between" style={{ marginBottom: 9 }}><span style={{ fontSize: 13, fontWeight: 640 }}>{m.text}</span><Pill tone="ok"><Icon name="check" size={11} stroke={2.4} />Done</Pill></div>
                    <Bar value={m.prog ?? 0} color="var(--ok)" h={6} />
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8 }} className="mono">{m.sub}</div>
                  </div>
                ) : m.type === "code" ? (
                  <div style={{ borderRadius: "4px 16px 16px 16px", overflow: "hidden", border: "1px solid var(--border)" }}>
                    <div className="between" style={{ padding: "8px 12px", background: "var(--surface-2)" }}><span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>javascript</span><Icon name="code" size={13} style={{ color: "var(--text-faint)" }} /></div>
                    <pre className="mono" style={{ margin: 0, padding: 13, fontSize: 11.5, lineHeight: 1.6, color: "var(--cyan)", background: "var(--surface)", overflowX: "auto", whiteSpace: "pre" }}>{m.text}</pre>
                  </div>
                ) : (
                  <div className="card" style={{ padding: "11px 14px", borderRadius: "4px 16px 16px 16px", fontSize: 14, color: "var(--text)" }}>
                    {m.type === "markdown" ? <MD text={m.text} /> : m.text}
                  </div>
                )}
                {m.time && <span style={{ fontSize: 10.5, color: "var(--text-ghost)", marginLeft: 4, marginTop: 4, display: "inline-block" }}>{m.time}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 14px 12px", flexShrink: 0 }}>
        <div className="glass" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 16px", borderRadius: 24 }}>
          <input placeholder={`Message ${a.name}…`} style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 14.5, fontFamily: "inherit" }} />
          <button className="tap" style={{ width: 36, height: 36, borderRadius: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}><Icon name="mic" size={19} /></button>
          <button className="tap" style={{ width: 38, height: 38, borderRadius: 38, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", }}><Icon name="send" size={18} /></button>
        </div>
      </div>
      <Sheet open={sheet === "controls"} onClose={() => setSheet(null)} title="Agent controls">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {controls.map(c => {
            const cc = TONE_COLOR[c.tone];
            return (
              <button key={c.label} className="tap card" onClick={() => setSheet(null)} style={{ padding: "15px", display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: `color-mix(in oklab, ${cc} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: cc }}><Icon name={c.icon} size={18} stroke={2} /></div>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
      <Sheet open={memOpen} onClose={() => setMemOpen(false)} title="Agent memory">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 680, color: "var(--text-faint)", letterSpacing: 0.4, marginBottom: 8 }}>CURRENT OBJECTIVES</div>
            {["Compile wearables market analysis", "Identify top 3 growth segments", "Produce one-page exec summary"].map((o, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0" }}>
                <Icon name={i < 2 ? "check" : "target"} size={15} style={{ color: i < 2 ? "var(--ok)" : "var(--accent)" }} stroke={2.2} />
                <span style={{ fontSize: 13.5, color: i < 2 ? "var(--text-faint)" : "var(--text)", textDecoration: i < 2 ? "line-through" : "none" }}>{o}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 680, color: "var(--text-faint)", letterSpacing: 0.4, marginBottom: 8 }}>CONTEXT MEMORY</div>
            <div className="card" style={{ padding: 12 }}>
              <div className="between" style={{ marginBottom: 8 }}><span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Context window</span><span className="mono" style={{ fontSize: 12 }}>82K / 128K</span></div>
              <Bar value={64} color="var(--purple)" h={6} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 680, color: "var(--text-faint)", letterSpacing: 0.4, marginBottom: 8 }}>KNOWLEDGE SOURCES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {["14 web sources", "RAG: market-db", "internal/q1-data.csv", "Bloomberg API"].map(s => <Pill key={s} tone="cyan"><Icon name="database" size={11} stroke={2} />{s}</Pill>)}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export function MultiAgent({ nav }: ScreenProps) {
  const roles: { name: string; color: string; icon: IconName; role: string; status: "running" | "done" | "waiting" }[] = [
    { name: "Manager Agent", color: "blue", icon: "target", role: "Coordinating", status: "running" },
    { name: "Research Agent", color: "cyan", icon: "search", role: "Requirements", status: "done" },
    { name: "Coding Agent", color: "purple", icon: "code", role: "Implementation", status: "running" },
    { name: "Design Agent", color: "pink", icon: "edit", role: "UI / UX", status: "running" },
    { name: "QA Agent", color: "amber", icon: "check", role: "Testing", status: "waiting" },
  ];
  const feed = [
    { who: "Manager Agent", color: "blue", text: "Delegated 4 subtasks. Coding & Design running in parallel.", time: "now" },
    { who: "Research Agent", color: "cyan", text: "✓ Requirements doc complete — 12 user stories, 3 personas.", time: "2m" },
    { who: "Coding Agent", color: "purple", text: "Scaffolding React Native project. Auth + onboarding next.", time: "4m" },
    { who: "Design Agent", color: "pink", text: "Generated 3 home-screen concepts. Awaiting Manager review.", time: "5m" },
  ];
  const stTone: Record<string, Tone> = { running: "ok", done: "info", waiting: "warn" };
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Multi-Agent Workspace" sub="5 agents · live collaboration" right={<GhostBtn icon="flow" size={38} onClick={() => nav.push("workflow")} />} />
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 14, background: "linear-gradient(135deg, rgba(91,140,255,0.16), rgba(167,121,255,0.12))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}><Icon name="target" size={15} style={{ color: "var(--accent)" }} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "var(--accent)" }}>SHARED GOAL</span></div>
          <div style={{ fontSize: 18, fontWeight: 720, letterSpacing: -0.4, marginBottom: 12 }}>“Build a fitness app”</div>
          <div className="between"><span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Overall progress</span><span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>62%</span></div>
          <div style={{ marginTop: 7 }}><Bar value={62} h={7} color="var(--accent)" /></div>
        </div>
        <Section title="Workflow" action="Open builder" onAction={() => nav.push("workflow")} />
        <div className="card" style={{ padding: "16px 14px", marginBottom: 16, overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content" }}>
            {roles.map((r, i) => (
              <Fragment key={r.name}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 64 }}>
                  <div style={{ position: "relative" }}>
                    <Avatar name={r.name} color={r.color} icon={r.icon} size={42} />
                    <span style={{ position: "absolute", bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: `var(--${stTone[r.status] === "info" ? "accent" : stTone[r.status] === "ok" ? "ok" : "warn"})`, border: "2px solid var(--surface-solid)" }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.2 }}>{r.role}</span>
                </div>
                {i < roles.length - 1 && <div style={{ width: 22, height: 2, background: "var(--border-strong)", flexShrink: 0, marginBottom: 18, borderRadius: 2 }} />}
              </Fragment>
            ))}
          </div>
        </div>
        <Section title="Agents & roles" />
        <div className="card" style={{ padding: "2px 14px", marginBottom: 16 }}>
          {roles.map((r, i) => (
            <Row key={r.name} last={i === roles.length - 1} icon={r.icon} iconColor={`var(--${r.color === "blue" ? "accent" : r.color})`} iconBg="var(--surface-2)"
              title={r.name} sub={r.role}
              right={<Pill tone={stTone[r.status]}>{r.status === "running" && <Dot size={5} color="var(--ok)" pulse />}{r.status}</Pill>} />
          ))}
        </div>
        <Section title="Inter-agent messages" />
        <div className="card" style={{ padding: 14 }}>
          {feed.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: i < feed.length - 1 ? "1px solid var(--border)" : "none" }}>
              <Avatar name={f.who} color={f.color} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="between"><span style={{ fontSize: 12.5, fontWeight: 640 }}>{f.who}</span><span style={{ fontSize: 10.5, color: "var(--text-ghost)" }}>{f.time}</span></div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export function Models({ nav }: ScreenProps) {
  const d = useData();
  const liveModels = d.models.length ? d.models : MODELS;
  const [sheet, setSheet] = useState<Model | null>(null);
  const stTone: Record<Model["status"], Tone> = { active: "ok", loaded: "info", available: "neutral" };
  const activeCount = liveModels.filter(m => m.status === "active").length;
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Local LLM Models" sub={`${liveModels.length} installed · ${activeCount} active`} right={<GhostBtn icon="download" size={38} onClick={() => {}} />} />
      <div className="pad">
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="between" style={{ marginBottom: 12 }}><span style={{ fontSize: 13.5, fontWeight: 640 }}>GPU Memory</span><span className="mono" style={{ fontSize: 12, color: "var(--cyan)" }}>38 / 49 GB</span></div>
          <Bar value={77} color="var(--cyan)" h={8} />
          <div style={{ display: "flex", gap: 16, marginTop: 13 }}>
            {[["3", "Active"], ["6", "Installed"], ["128K", "Max ctx"]].map(([v, l]) => (
              <div key={l}><div style={{ fontSize: 18, fontWeight: 740, letterSpacing: -0.4 }}>{v}</div><div style={{ fontSize: 11, color: "var(--text-faint)" }}>{l}</div></div>
            ))}
          </div>
        </div>
        <Section title="Installed models" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {liveModels.map(m => (
            <button key={m.id} className="tap card" onClick={() => setSheet(m)} style={{ padding: 14, textAlign: "left", display: "block", width: "100%" }}>
              <div className="between" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple)", flexShrink: 0 }}><Icon name="brain" size={19} stroke={1.9} /></div>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 640 }} className="clip">{m.name}</div><div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }}>{m.family} · {m.size} · {m.ctx} ctx</div></div>
                </div>
                <Pill tone={stTone[m.status]}>{m.status === "active" && <Dot size={5} color="var(--ok)" pulse />}{m.status}</Pill>
              </div>
              <div className="between"><span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{m.agents} agent{m.agents !== 1 ? "s" : ""} assigned</span>{m.vram > 0 && <span className="mono" style={{ fontSize: 11, color: "var(--cyan)" }}>{m.vram} GB VRAM</span>}</div>
            </button>
          ))}
        </div>
      </div>
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.name}>
        <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <Pill tone={sheet ? stTone[sheet.status] : "neutral"}>{sheet?.status}</Pill><Pill tone="neutral">{sheet?.size}</Pill><Pill tone="cyan">{sheet?.ctx} context</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          {([{ i: "play", l: "Load Model", t: "ok" }, { i: "stop", l: "Stop Model", t: "warn" }, { i: "refresh", l: "Update", t: "info" }, { i: "trash", l: "Delete", t: "err" }] as { i: IconName; l: string; t: Tone }[]).map(b => {
            const cc = TONE_COLOR[b.t];
            return <button key={b.l} className="tap card" onClick={() => setSheet(null)} style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 34, height: 34, borderRadius: 10, background: `color-mix(in oklab, ${cc} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: cc }}><Icon name={b.i} size={17} stroke={2} /></div><span style={{ fontSize: 13, fontWeight: 600 }}>{b.l}</span></button>;
          })}
        </div>
      </Sheet>
    </div>
  );
}

export function Notifications({ nav }: ScreenProps) {
  const tone = (t: Tone) => TONE_COLOR[t];
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Notifications" sub="3 unread" right={<button className="tap" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>Clear</button>} />
      <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {NOTIFS.map(n => (
          <div key={n.id} className="card" style={{ padding: 14, display: "flex", gap: 12, position: "relative", opacity: n.unread ? 1 : 0.72 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in oklab, ${tone(n.tone)} 15%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", color: tone(n.tone), flexShrink: 0 }}><Icon name={n.icon} size={19} stroke={2} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="between"><span style={{ fontSize: 14, fontWeight: 640 }}>{n.title}</span><span style={{ fontSize: 11, color: "var(--text-ghost)", flexShrink: 0 }}>{n.time}</span></div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 3, lineHeight: 1.4 }}>{n.text}</div>
            </div>
            {n.unread && <span style={{ position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: 4, background: "var(--accent)" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreateAgent({ nav }: ScreenProps) {
  const colors: AgentColor[] = ["blue", "purple", "cyan", "green", "amber", "pink"];
  const [c, setC] = useState<AgentColor>("blue");
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Create Agent" />
      <div className="pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}><Avatar name="New" color={c} icon="robot" size={76} glow /></div>
        <Field label="AGENT NAME" placeholder="e.g. Analytics Agent" value="" onChange={() => {}} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 620, color: "var(--text-faint)", marginBottom: 8, marginLeft: 2 }}>COLOR</div>
          <div style={{ display: "flex", gap: 10 }}>{colors.map(x => <button key={x} className="tap" onClick={() => setC(x)} style={{ width: 38, height: 38, borderRadius: 11, background: AGENT_GRAD[x], border: c === x ? "2px solid var(--text)" : "2px solid transparent" }} />)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 620, color: "var(--text-faint)", marginBottom: 8, marginLeft: 2 }}>MODEL</div>
          <div className="card" style={{ padding: "2px 14px" }}>
            {MODELS.slice(0, 3).map((m, i) => <Row key={m.id} last={i === 2} icon="brain" iconColor="var(--purple)" iconBg="var(--surface-2)" title={m.name} sub={`${m.family} · ${m.ctx}`} right={i === 0 ? <Icon name="check" size={18} style={{ color: "var(--accent)" }} /> : null} />)}
          </div>
        </div>
        <Field label="SYSTEM PROMPT" placeholder="Describe the agent's role & objectives…" value="" onChange={() => {}} />
      </div>
      <div style={{ padding: "8px 18px 16px" }}><Btn full size="lg" icon="rocket" onClick={nav.pop}>Deploy Agent</Btn></div>
    </div>
  );
}

function GenericDetail({ nav, title, children }: { nav: Nav; title: string; children?: ReactNode }) {
  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title={title} />
      <div className="pad">{children}</div>
    </div>
  );
}

export function TaskDetail({ nav }: ScreenProps) {
  let t: MockTask = TASKS["In Progress"][0];
  let col: TaskCol = "In Progress";
  for (const c of TASK_COLS) { const f = TASKS[c].find(x => x.id === nav.params.id); if (f) { t = f; col = c; } }
  return (
    <GenericDetail nav={nav} title="Task">
      <Pill tone={COL_TONE[col]} style={{ marginBottom: 12 }}>{col}</Pill>
      <h1 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 760, letterSpacing: -0.6, lineHeight: 1.15 }}>{t.title}</h1>
      {t.prog !== undefined && <div style={{ marginBottom: 18 }}><div className="between" style={{ marginBottom: 7 }}><span style={{ fontSize: 13, color: "var(--text-dim)" }}>Progress</span><span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{t.prog}%</span></div><Bar value={t.prog} h={8} /></div>}
      <div className="card" style={{ padding: "4px 14px", marginBottom: 16 }}>
        {[["Assigned agent", t.agent], ["Priority", t.priority], ["Due date", t.due], ["Status", col]].map(([k, v], i) => (
          <div key={k} className="between" style={{ padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}><span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 580 }}>{v}</span></div>
        ))}
      </div>
      <Section title="Activity log" />
      <div className="card" style={{ padding: 14 }}>
        {["Task created and assigned", "Agent began execution", "Checkpoint: 2 of 3 subtasks done"].map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0" }}><div style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent)", marginTop: 5 }} /><div><div style={{ fontSize: 13, color: "var(--text-dim)" }}>{l}</div><span className="mono" style={{ fontSize: 11, color: "var(--text-ghost)" }}>10:3{i} AM</span></div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}><Btn full variant="glass" icon="message" onClick={() => nav.push("agentChat", { id: "coding" })}>Open chat</Btn><Btn full icon="check" onClick={nav.pop}>Mark done</Btn></div>
    </GenericDetail>
  );
}

export function FileDetail({ nav }: ScreenProps) {
  const f = FILES.find(x => x.id === nav.params.id) || FILES[0];
  return (
    <GenericDetail nav={nav} title="File">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 22px" }}>
        <div style={{ width: 72, height: 88, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: `var(--${FILE_TONE[f.type] === "neutral" ? "text-dim" : FILE_TONE[f.type]})`, marginBottom: 14, position: "relative" }}>
          <Icon name="doc" size={34} stroke={1.6} /><span className="mono" style={{ position: "absolute", bottom: 10, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{f.type.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 680, textAlign: "center", padding: "0 20px" }} className="clip">{f.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>{f.size} · {f.agent} · {f.time}</div>
        {f.ai && <Pill tone="purple" style={{ marginTop: 10 }}><Icon name="spark" size={11} stroke={2} />AI Generated</Pill>}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}><Btn full variant="glass" icon="eye" onClick={() => {}}>Preview</Btn><Btn full icon="download" onClick={() => {}}>Download</Btn></div>
      <Section title="Version history" />
      <div className="card" style={{ padding: "2px 14px" }}>
        {[["v3 · current", f.time, "var(--accent)"], ["v2", "Yesterday", "var(--text-faint)"], ["v1 · created", "Jun 8", "var(--text-faint)"]].map(([v, t, c], i) => (
          <Row key={v} last={i === 2} icon="clock" iconColor={c} iconBg="var(--surface-2)" title={v} sub={t} right={i === 0 ? <Pill tone="ok">Latest</Pill> : <Icon name="download" size={16} style={{ color: "var(--text-ghost)" }} />} />
        ))}
      </div>
    </GenericDetail>
  );
}

export function Upload({ nav }: ScreenProps) {
  return (
    <GenericDetail nav={nav} title="Upload File">
      <div className="card tap" style={{ padding: "40px 20px", border: "1.5px dashed var(--border-strong)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 18, marginTop: 6 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}><Icon name="upload" size={28} /></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 15, fontWeight: 640 }}>Drop files or tap to browse</div><div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>PDF, DOCX, CSV, XLSX, ZIP, images, code</div></div>
      </div>
      <Section title="Recent uploads" />
      <div className="card" style={{ padding: "2px 14px" }}>
        {FILES.filter(f => !f.ai).map((f, i, ar) => <Row key={f.id} last={i === ar.length - 1} icon="doc" iconColor="var(--text-dim)" iconBg="var(--surface-2)" title={f.name} sub={`${f.size} · ${f.time}`} chev onClick={() => {}} />)}
      </div>
    </GenericDetail>
  );
}

export function CreateTask({ nav }: ScreenProps) {
  return (
    <GenericDetail nav={nav} title="New Task">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 6 }}>
        <Field label="TASK TITLE" placeholder="What needs to get done?" value="" onChange={() => {}} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 620, color: "var(--text-faint)", marginBottom: 8, marginLeft: 2 }}>ASSIGN TO</div>
          <div className="card" style={{ padding: "2px 14px" }}>{AGENTS.slice(0, 3).map((a, i) => <Row key={a.id} last={i === 2} icon={a.icon} iconColor={`var(--${a.color === "blue" ? "accent" : a.color})`} iconBg="var(--surface-2)" title={a.name} sub={a.model} right={i === 0 ? <Icon name="check" size={18} style={{ color: "var(--accent)" }} /> : null} />)}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 620, color: "var(--text-faint)", marginBottom: 8, marginLeft: 2 }}>PRIORITY</div>
          <div style={{ display: "flex", gap: 9 }}>{["Low", "Normal", "High"].map((p, i) => <button key={p} className="tap card" style={{ flex: 1, padding: "11px", fontSize: 13, fontWeight: 600, color: i === 2 ? "var(--err)" : "var(--text-dim)", border: i === 2 ? "1px solid var(--err)" : "1px solid var(--border)" }}>{p}</button>)}</div>
        </div>
      </div>
      <div style={{ padding: "24px 0 0" }}><Btn full size="lg" icon="plus" onClick={nav.pop}>Create Task</Btn></div>
    </GenericDetail>
  );
}

export function Profile({ nav }: ScreenProps) {
  return (
    <GenericDetail nav={nav} title="Profile">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 20px" }}>
        <Avatar name="Alex Pierce" color="slate" size={84} />
        <div style={{ fontSize: 20, fontWeight: 740, marginTop: 14, letterSpacing: -0.4 }}>Alex Pierce</div>
        <div style={{ fontSize: 13.5, color: "var(--text-faint)", marginTop: 3 }}>admin@agentcmd.io</div>
        <Pill tone="info" style={{ marginTop: 10 }}><Icon name="shield" size={11} stroke={2.4} />Administrator</Pill>
      </div>
      <div className="card" style={{ padding: "2px 14px" }}>
        {[["Role", "Administrator"], ["Member since", "Jan 2025"], ["Last login", "Today, 10:24 AM"], ["Trusted devices", "2"]].map(([k, v], i) => (
          <div key={k} className="between" style={{ padding: "13px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}><span style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 580 }}>{v}</span></div>
        ))}
      </div>
    </GenericDetail>
  );
}
