"use client";

import { useState, type ReactNode } from "react";
import { Btn, Icon, type IconName } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";

export function Field({ icon, label, value, onChange, type = "text", placeholder, right }: {
  icon?: IconName; label?: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; right?: ReactNode;
}) {
  return (
    <div>
      {label && <div style={{ fontSize: 12, fontWeight: 620, color: "var(--text-faint)", marginBottom: 7, marginLeft: 2, letterSpacing: 0.2 }}>{label}</div>}
      <div className="glass" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 52, borderRadius: 15 }}>
        {icon && <Icon name={icon} size={18} style={{ color: "var(--text-faint)" }} />}
        <input type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 15, fontFamily: "inherit", fontWeight: 500 }} />
        {right}
      </div>
    </div>
  );
}

function Logo({ size = 60 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.3, background: "linear-gradient(150deg,#5b8cff,#6d3df0)", display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative" }}>
      <span style={{ color: "#fff", fontSize: size * 0.52, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>J</span>
    </div>
  );
}

export function LoginScreen({ nav }: ScreenProps) {
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [email, setEmail] = useState("admin@agentcmd.io");
  const [pw, setPw] = useState("••••••••••");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [approving, setApproving] = useState(false);

  const submitCode = () => {
    setApproving(true);
    setTimeout(() => nav.replace("dashboard"), 1400);
  };

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 26px", width: "100%", maxWidth: 440, margin: "0 auto" }} className="anim-screen">
        {step === "login" && <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 34 }}>
            <Logo size={66} />
            <h1 style={{ margin: "20px 0 4px", fontSize: 27, fontWeight: 780, letterSpacing: -0.8 }}>Agent Command</h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-faint)", fontWeight: 500 }}>Secure AI Operations Center</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field icon="users" label="EMAIL" value={email} onChange={setEmail} />
            <Field icon="lock" label="PASSWORD" value={pw} onChange={setPw} type="password"
              right={<Icon name="eye" size={18} style={{ color: "var(--text-faint)" }} />} />
            <div style={{ textAlign: "right", marginTop: -2 }}>
              <button className="tap" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 580 }}>Forgot password?</button>
            </div>
            <Btn full size="lg" icon="lock" onClick={() => setStep("mfa")} style={{ marginTop: 6 }}>Sign in securely</Btn>
          </div>
          <div className="glass" style={{ marginTop: 22, padding: "12px 14px", borderRadius: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="shield" size={18} style={{ color: "var(--ok)" }} />
            <span style={{ fontSize: 12.5, color: "var(--text-dim)", fontWeight: 500 }}>Protected by MFA & device approval</span>
          </div>
          <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-ghost)", marginTop: 24, lineHeight: 1.5 }}>No public registration. Accounts are provisioned<br />by your system administrator.</p>
        </>}

        {step === "mfa" && <>
          <button className="tap" onClick={() => setStep("login")} style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--accent)", fontSize: 14, fontWeight: 560, marginBottom: 30, alignSelf: "flex-start" }}><Icon name="chevL" size={18} />Back</button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 30 }}>
            <div className="glass" style={{ width: 60, height: 60, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: 18 }}><Icon name="key" size={28} /></div>
            <h1 style={{ margin: "0 0 6px", fontSize: 23, fontWeight: 760, letterSpacing: -0.5 }}>Two-factor auth</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-faint)", textAlign: "center", lineHeight: 1.45 }}>Enter the 6-digit code from your<br />authenticator app</p>
          </div>
          <div style={{ display: "flex", gap: 9, justifyContent: "center", marginBottom: 26 }}>
            {code.map((c, i) => (
              <input key={i} value={c} maxLength={1} inputMode="numeric"
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, "");
                  const nc = [...code]; nc[i] = v; setCode(nc);
                  if (v && i < 5) { (e.target.parentNode?.children[i + 1] as HTMLInputElement | undefined)?.focus(); }
                }}
                className="glass" style={{ width: 46, height: 56, borderRadius: 14, textAlign: "center", fontSize: 24, fontWeight: 720, color: "var(--text)", outline: "none",
                  border: c ? "1px solid var(--accent)" : "1px solid var(--border)" }} />
            ))}
          </div>
          {approving ? (
            <div className="glass" style={{ padding: "14px", borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 11 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid var(--surface-2)", borderTopColor: "var(--accent)", animation: "spin .7s linear infinite" }} />
              <span style={{ fontSize: 14, fontWeight: 580, color: "var(--text-dim)" }}>Verifying device…</span>
            </div>
          ) : (
            <Btn full size="lg" icon="check" onClick={submitCode}>Verify & continue</Btn>
          )}
          <button className="tap" style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 540, margin: "18px auto 0", display: "block" }}>Resend code · 0:24</button>
        </>}
      </div>
    </div>
  );
}

const ONB_STEPS: { icon: IconName; title: string; desc: string; action: string; note: string }[] = [
  { icon: "monitor", title: "Connect your Mac M4", desc: "Sign in to the Mac Mini, Studio, or MacBook running your private AI server.", action: "Detect Mac on network", note: "Found: Mac Studio M4 · 192.168.1.24" },
  { icon: "download", title: "Install OpenClaw Connector", desc: "Deploy the secure connector agent so the app can orchestrate local LLMs.", action: "Install connector", note: "openclaw-connector v2.4 · verified signature" },
  { icon: "link", title: "Pair this device", desc: "Approve this iPhone as a trusted controller. A code will appear on your Mac.", action: "Enter pairing code", note: "Trusted device added" },
  { icon: "shield", title: "Verify secure connection", desc: "Establishing end-to-end encrypted tunnel to your private server.", action: "Run security check", note: "TLS 1.3 · E2E encrypted · 0 warnings" },
  { icon: "robot", title: "Deploy your first agent", desc: "Spin up a Research Agent on your most capable local model to get started.", action: "Deploy Research Agent", note: "Research Agent online · Qwen2.5-72B" },
  { icon: "rocket", title: "Start your AI Workspace", desc: "Everything's wired. Your command center is ready for autonomous work.", action: "Enter command center", note: "" },
];

export function OnboardingScreen({ nav }: ScreenProps) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const [working, setWorking] = useState(false);
  const s = ONB_STEPS[i];
  const last = i === ONB_STEPS.length - 1;

  const act = () => {
    if (last) { nav.replace("dashboard"); return; }
    setWorking(true);
    setTimeout(() => { setWorking(false); setDone(true); }, 1300);
  };
  const next = () => { setDone(false); setI(i + 1); };

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div className="between" style={{ padding: "8px 20px 4px" }}>
        <button className="tap" onClick={() => i === 0 ? nav.replace("login") : (setDone(false), setI(i - 1))} style={{ color: "var(--text-faint)", display: "flex", alignItems: "center" }}><Icon name="chevL" size={22} /></button>
        <span style={{ fontSize: 12.5, fontWeight: 640, color: "var(--text-faint)", letterSpacing: 0.3 }}>STEP {i + 1} OF 6</span>
        <button className="tap" onClick={() => nav.replace("dashboard")} style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 560 }}>Skip</button>
      </div>
      <div style={{ display: "flex", gap: 5, padding: "12px 20px 8px" }}>
        {ONB_STEPS.map((_, k) => (
          <div key={k} style={{ flex: 1, height: 4, borderRadius: 3, background: k <= i ? "var(--accent)" : "var(--surface-2)", transition: "background .4s" }} />
        ))}
      </div>
      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 26px 30px", animation: "slideIn .4s cubic-bezier(.2,.7,.2,1)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ alignSelf: "center", position: "relative", marginBottom: 40 }}>
            <div style={{ position: "absolute", inset: -28, borderRadius: "50%", background: "radial-gradient(circle, rgba(var(--accent-rgb),0.28), transparent 70%)", filter: "blur(8px)" }} />
            <div style={{ width: 116, height: 116, borderRadius: 34, position: "relative",
              background: "linear-gradient(155deg, var(--surface-2), var(--surface))", border: "1px solid var(--border-strong)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", animation: "drift 4s ease-in-out infinite" }}>
              <Icon name={s.icon} size={52} stroke={1.6} />
            </div>
          </div>
          <h1 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 780, letterSpacing: -0.8, textAlign: "center", lineHeight: 1.1 }}>{s.title}</h1>
          <p style={{ margin: "0 auto", fontSize: 15, color: "var(--text-dim)", textAlign: "center", lineHeight: 1.5, maxWidth: 280 }}>{s.desc}</p>
          {(done && s.note) && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, alignSelf: "center", marginTop: 22, padding: "10px 16px", borderRadius: 100, background: "var(--ok-soft)", animation: "popIn .3s" }}>
              <Icon name="check" size={16} style={{ color: "var(--ok)" }} />
              <span className="mono" style={{ fontSize: 12.5, color: "var(--ok)", fontWeight: 600 }}>{s.note}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {!done ? (
            <Btn full size="lg" icon={working ? undefined : s.icon} onClick={act} disabled={working}>
              {working ? <><span style={{ width: 17, height: 17, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} /> Working…</> : s.action}
            </Btn>
          ) : (
            <Btn full size="lg" icon="arrowR" onClick={next}>Continue</Btn>
          )}
        </div>
      </div>
    </div>
  );
}
