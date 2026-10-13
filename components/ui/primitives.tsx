"use client";

import { useEffect, useMemo, useState, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";

// Reactive media-query hook — drives the mobile/desktop layout switch
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export const ICONS = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  chip: "M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M7 7h10v10H7z M10 10h4v4h-4z",
  columns: "M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v7h-4z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 6.3 6.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8 1.6 1.6 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
  terminal: "M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM7 9l3 3-3 3M13 15h4",
  chevR: "M9 6l6 6-6 6", chevL: "M15 6l-6 6 6 6", chevD: "M6 9l6 6 6-6", chevU: "M6 15l6-6 6 6",
  plus: "M12 5v14M5 12h14", minus: "M5 12h14",
  play: "M7 5l12 7-12 7z", pause: "M8 5v14M16 5v14", stop: "M6 6h12v12H6z",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  send: "M4 12l16-7-7 16-2-7z", search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  x: "M6 6l12 12M18 6L6 18", check: "M5 12l5 5L20 6",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16", download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  power: "M12 4v8M7 6a8 8 0 1 0 10 0", refresh: "M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4",
  moon: "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z", lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  wifi: "M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M12 18.5h.01",
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M6 6h12v12H6zM10 10h4v4h-4z",
  ram: "M3 8h18v8H3zM6 16v2M10 16v2M14 16v2M18 16v2M7 11h2M11 11h2M15 11h2",
  gpu: "M2 7h16v9H2zM5 16v2M9 16v2M18 10h4v4M9 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
  disk: "M4 5h16v14H4zM7 9h.01M12 9h.01M7 14h10",
  network: "M12 3v6M12 15v6M5 12h6M13 12h6M9 9l6 6M15 9l-6 6",
  clock: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2",
  bolt: "M13 3L4 14h7l-1 7 9-11h-7z", message: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z",
  users: "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-2a4 4 0 0 0-3-3.8M16 2.2A4 4 0 0 1 16 9.8",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  flow: "M5 4h5v5H5zM14 15h5v5h-5zM7.5 9v3a2 2 0 0 0 2 2h5",
  key: "M14 7a4 4 0 1 1-5 5l-5 5v3h3l1-1h2v-2h2l1-1a4 4 0 0 0 4-9z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  edit: "M4 20h4L18 10l-4-4L4 16zM14 6l4 4",
  sliders: "M4 8h10M18 8h2M4 16h2M10 16h10M14 6v4M8 14v4",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 4l.7 2 .3.7M6 17l.7 2",
  robot: "M12 3v3M8 9h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM9.5 13h.01M14.5 13h.01M4 12v3M20 12v3",
  arrowU: "M12 19V5M5 12l7-7 7 7", arrowD: "M12 5v14M5 12l7 7 7-7",
  arrowR: "M5 12h14M13 5l7 7-7 7", arrowL: "M19 12H5M11 5l-7 7 7 7",
  star: "M12 3l2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-.5z",
  flag: "M5 21V4h13l-2 4 2 4H5", pin: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6", code: "M9 8l-4 4 4 4M15 8l4 4-4 4",
  link: "M9 15l6-6M8 8H6a4 4 0 0 0 0 8h2M16 16h2a4 4 0 0 0 0-8h-2",
  filter: "M4 5h16l-6 7v6l-4 2v-8z", calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  cloud: "M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1A4 4 0 0 1 17 18z",
  database: "M5 6c0-1.5 3-3 7-3s7 1.5 7 3-3 3-7 3-7-1.5-7-3zM5 6v12c0 1.5 3 3 7 3s7-1.5 7-3V6M5 12c0 1.5 3 3 7 3s7-1.5 7-3",
  brain: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 4 3 3 0 0 0 5 1V4.5A2.5 2.5 0 0 0 9 4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 4 3 3 0 0 1-5 1",
  pulse: "M3 12h4l2-6 4 12 2-6h6", target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  thermometer: "M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0zM12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  battery: "M3 8h15v8H3zM21 11v2M6 11v2",
  rocket: "M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9zM12 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M9 18l-2 3M15 18l2 3",
  store: "M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6",
  book: "M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 0-2 2zM5 4v16M9 8h6M9 12h4",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  image: "M3 5h18v14H3zM3 14l5-5 4 4 3-3 5 5M14 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  archive: "M3 5h18v4H3zM5 9v10h14V9M10 13h4",
  warn: "M10.3 4l-8 14h15.5L10.3 4zM10.3 10v4M10.3 16h.01",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, stroke = 2, fill = "none", style }: {
  name: IconName; size?: number; stroke?: number; fill?: string; style?: CSSProperties;
}) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

export function StatusBar() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => { const d = new Date(); const h = d.getHours() % 12 || 12; setT(`${h}:${String(d.getMinutes()).padStart(2, "0")}`); };
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <div className="statusbar">
      <span className="time">{t}</span>
      <div className="glyphs">
        <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="7.5" width="3" height="4.5" rx="0.7"/><rect x="4.5" y="5" width="3" height="7" rx="0.7"/><rect x="9" y="2.5" width="3" height="9.5" rx="0.7"/><rect x="13.5" y="0" width="3" height="12" rx="0.7"/></svg>
        <svg width="16" height="12" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z"/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z"/><circle cx="8.5" cy="10.5" r="1.4"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.5" y="0.8" width="22" height="11.4" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.4"/><rect x="2" y="2.3" width="17" height="8.4" rx="1.8"/><path d="M24 4.5v4c.8-.3 1.4-1.2 1.4-2s-.6-1.7-1.4-2z"/></svg>
      </div>
    </div>
  );
}

export const AGENT_GRAD = {
  blue: "linear-gradient(140deg,#5b8cff,#2d5bd6)", purple: "linear-gradient(140deg,#a779ff,#6d3df0)",
  cyan: "linear-gradient(140deg,#3dd9c9,#1f9f93)", green: "linear-gradient(140deg,#34d399,#0e9f6e)",
  amber: "linear-gradient(140deg,#fbbf24,#e08a00)", pink: "linear-gradient(140deg,#f871a0,#d6437a)",
  slate: "linear-gradient(140deg,#94a3c4,#5a6786)",
};

export type AgentColor = keyof typeof AGENT_GRAD;

export function Avatar({ name, color = "blue", size = 40, icon, glow }: {
  name?: string; color?: string; size?: number; icon?: IconName; glow?: boolean;
}) {
  const initials = name ? name.split(" ").map(w => w[0]).slice(0, 2).join("") : "";
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: AGENT_GRAD[color as AgentColor] || AGENT_GRAD.blue,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff",
      fontWeight: 680, fontSize: size * 0.36, boxShadow: glow ? `0 6px 18px rgba(91,140,255,0.0), 0 0 0 1px rgba(255,255,255,0.14) inset` : "0 0 0 1px rgba(255,255,255,0.12) inset" }}>
      {icon ? <Icon name={icon} size={size * 0.5} stroke={2} /> : initials}
    </div>
  );
}

export function Dot({ color = "var(--ok)", size = 7, pulse }: { color?: string; size?: number; pulse?: boolean }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0,
    boxShadow: `0 0 8px ${color}`, animation: pulse ? "pulse 2s infinite" : "none" }} />;
}

const PILL_TONES = {
  neutral: ["var(--surface-2)", "var(--text-dim)"], ok: ["var(--ok-soft)", "var(--ok)"],
  warn: ["var(--warn-soft)", "var(--warn)"], err: ["var(--err-soft)", "var(--err)"],
  info: ["rgba(var(--accent-rgb),0.16)", "var(--accent)"], purple: ["rgba(167,121,255,0.16)", "var(--purple)"],
  cyan: ["rgba(61,217,201,0.16)", "var(--cyan)"],
} as const;

export type Tone = keyof typeof PILL_TONES;

export function Pill({ children, tone = "neutral", style }: { children?: ReactNode; tone?: Tone; style?: CSSProperties }) {
  const [bg, fg] = PILL_TONES[tone] || PILL_TONES.neutral;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg,
    fontSize: 11.5, fontWeight: 620, padding: "4px 9px", borderRadius: 100, letterSpacing: 0.1, ...style }}>{children}</span>;
}

export function Bar({ value, color = "var(--accent)", h = 6, track = "var(--surface-2)" }: {
  value: number; color?: string; h?: number; track?: string;
}) {
  return <div style={{ height: h, borderRadius: h, background: track, overflow: "hidden", width: "100%" }}>
    <div style={{ height: "100%", width: `${Math.min(100, value)}%`, background: color, borderRadius: h, transition: "width .6s cubic-bezier(.2,.7,.2,1)" }} />
  </div>;
}

export function Ring({ value, size = 64, stroke = 6, color = "var(--accent)", label, sub }: {
  value: number; size?: number; stroke?: number; color?: string; label?: ReactNode; sub?: ReactNode;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      {label !== undefined && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 720, letterSpacing: -0.5 }}>{label}</span>
        {sub && <span style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 600, marginTop: -1 }}>{sub}</span>}
      </div>}
    </div>
  );
}

export function Sparkline({ data, color = "var(--accent)", w = 120, h = 36, fill: doFill = true }: {
  data: number[]; color?: string; w?: number; h?: number; fill?: boolean;
}) {
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
  const line = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 4) - 2}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const gid = useMemo(() => "sg" + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {doFill && <polygon points={area} fill={`url(#${gid})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MiniBars({ data, color = "var(--accent)", w = 120, h = 40, gap = 3 }: {
  data: number[]; color?: string; w?: number; h?: number; gap?: number;
}) {
  const max = Math.max(...data) || 1;
  const bw = (w - gap * (data.length - 1)) / data.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {data.map((v, i) => {
        const bh = Math.max(2, (v / max) * h);
        return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={Math.min(2, bw / 2)} fill={color} opacity={0.45 + 0.55 * (v / max)} />;
      })}
    </svg>
  );
}

export function Section({ title, action, onAction, style }: {
  title: ReactNode; action?: ReactNode; onAction?: () => void; style?: CSSProperties;
}) {
  return (
    <div className="between" style={{ padding: "0 4px 10px", ...style }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 680, letterSpacing: -0.2 }}>{title}</h3>
      {action && <button className="tap" onClick={onAction} style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", display: "flex", alignItems: "center", gap: 2 }}>{action}<Icon name="chevR" size={14} /></button>}
    </div>
  );
}

export function Header({ title, sub, onBack, right, large = true }: {
  title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode; large?: boolean;
}) {
  return (
    <div style={{ padding: large ? "6px 18px 14px" : "2px 18px 12px" }}>
      {onBack && <button className="tap" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--accent)", fontSize: 14, fontWeight: 560, marginBottom: 12, marginLeft: -4 }}><Icon name="chevL" size={18} />Back</button>}
      <div className="between" style={{ alignItems: "flex-end" }}>
        <div style={{ minWidth: 0 }}>
          {sub && <div style={{ fontSize: 12.5, color: "var(--text-faint)", fontWeight: 600, marginBottom: 3, letterSpacing: 0.3, textTransform: "uppercase" }}>{sub}</div>}
          <h1 style={{ margin: 0, fontSize: large ? 30 : 23, fontWeight: 760, letterSpacing: -0.8, lineHeight: 1.05 }}>{title}</h1>
        </div>
        {right}
      </div>
    </div>
  );
}

export function GhostBtn({ icon, onClick, size = 40, active, badge }: {
  icon: IconName; onClick?: MouseEventHandler<HTMLButtonElement>; size?: number; active?: boolean; badge?: boolean;
}) {
  return (
    <button className="tap glass" onClick={onClick} style={{ width: size, height: size, borderRadius: size, display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      color: active ? "var(--accent)" : "var(--text-dim)", flexShrink: 0 }}>
      <Icon name={icon} size={size * 0.5} stroke={1.9} />
      {badge && <span style={{ position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, background: "var(--err)", boxShadow: "0 0 0 2px var(--bg)" }} />}
    </button>
  );
}

const BTN_VARIANTS = {
  primary: { background: "var(--accent)", color: "#fff" },
  solid: { background: "var(--text)", color: "var(--bg)" },
  glass: { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--text-dim)" },
  danger: { background: "var(--err-soft)", color: "var(--err)" },
  ok: { background: "var(--ok-soft)", color: "var(--ok)" },
} satisfies Record<string, CSSProperties>;

export function Btn({ children, onClick, variant = "primary", icon, full, size = "md", style, disabled }: {
  children?: ReactNode; onClick?: MouseEventHandler<HTMLButtonElement>; variant?: keyof typeof BTN_VARIANTS;
  icon?: IconName; full?: boolean; size?: "sm" | "md" | "lg"; style?: CSSProperties; disabled?: boolean;
}) {
  const pad = size === "lg" ? "15px 22px" : size === "sm" ? "9px 14px" : "13px 18px";
  const fs = size === "lg" ? 16 : size === "sm" ? 13 : 15;
  const base: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: pad, fontSize: fs, fontWeight: 640,
    borderRadius: 15, width: full ? "100%" : undefined, letterSpacing: -0.1, opacity: disabled ? 0.5 : 1, ...style };
  return <button className="tap" onClick={onClick} disabled={disabled} style={{ ...base, ...BTN_VARIANTS[variant] }}>{icon && <Icon name={icon} size={fs + 3} stroke={2} />}{children}</button>;
}

export function Row({ icon, iconColor, iconBg, title, sub, right, onClick, last, chev }: {
  icon?: IconName; iconColor?: string; iconBg?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode;
  onClick?: () => void; last?: boolean; chev?: boolean;
}) {
  // A row with its own controls (right) and no click handler must not be a <button>,
  // or those controls would be nested buttons
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={onClick ? "tap" : undefined} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 4px", width: "100%", textAlign: "left",
      borderBottom: last ? "none" : "1px solid var(--border)" }}>
      {icon && <div style={{ width: 38, height: 38, borderRadius: 11, background: iconBg || "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: iconColor || "var(--text-dim)", flexShrink: 0 }}><Icon name={icon} size={19} stroke={1.9} /></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 580, letterSpacing: -0.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 1 }} className="clip">{sub}</div>}
      </div>
      {right}
      {chev && <Icon name="chevR" size={17} style={{ color: "var(--text-ghost)" }} />}
    </Tag>
  );
}

export function Sheet({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children?: ReactNode; title?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-end", animation: "fadeIn .2s ease" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }} />
      <div onClick={e => e.stopPropagation()} className="glass" style={{ position: "relative", width: "100%", borderRadius: "28px 28px 0 0", padding: "10px 18px 38px",
        background: "var(--surface-solid)", borderBottom: "none", animation: "popIn .32s cubic-bezier(.2,.8,.2,1)", maxHeight: "82%", overflowY: "auto" }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: "var(--text-ghost)", margin: "0 auto 16px" }} />
        {title && <h3 style={{ margin: "0 0 16px", fontSize: 19, fontWeight: 720, letterSpacing: -0.4 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, sub, onBack, right, center }: {
  title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode; center?: boolean;
}) {
  return (
    <div className="between" style={{ padding: "6px 14px 10px", gap: 8, flexShrink: 0 }}>
      <button className="tap glass" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", flexShrink: 0 }}><Icon name="chevL" size={20} /></button>
      <div style={{ flex: 1, minWidth: 0, textAlign: center ? "center" : "left" }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.3 }} className="clip">{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 1 }} className="clip">{sub}</div>}
      </div>
      {right || <div style={{ width: 38 }} />}
    </div>
  );
}

// Minimal markdown: **bold** and numbered-list indentation
export function MD({ text }: { text: string }) {
  return text.split("\n").map((ln, i) => {
    const parts = ln.split(/(\*\*[^*]+\*\*)/g).map((p, j) => p.startsWith("**") ? <strong key={j} style={{ fontWeight: 720 }}>{p.slice(2, -2)}</strong> : p);
    const isNum = /^\d+\.\s/.test(ln);
    return <div key={i} style={{ marginBottom: 3, paddingLeft: isNum ? 4 : 0, lineHeight: 1.5 }}>{parts}</div>;
  });
}
