"use client";

import { useState } from "react";
import { Btn, Dot, Icon, Pill, Sheet, TopBar } from "@/components/ui/primitives";
import type { ScreenProps } from "@/lib/nav";
import { useData, useModelConfig, useSetDefaultModel } from "@/lib/queries";
import type { Model } from "@/lib/types";

export function DefaultModel({ nav }: ScreenProps) {
  const { models, loading } = useData();
  const { data: config } = useModelConfig();
  const setModel = useSetDefaultModel();
  const [confirm, setConfirm] = useState<Model | null>(null);
  const current = config?.defaultModel;

  return (
    <div className="screen pad-b" style={{ animation: "slideIn .35s cubic-bezier(.2,.7,.2,1)" }}>
      <TopBar onBack={nav.pop} title="Default Model" sub="Used by agents without their own model" />
      <div className="pad">
        {setModel.error && <div className="card" style={{ padding: 13, marginBottom: 14, color: "var(--err)", fontSize: 13 }}>{setModel.error.message}</div>}
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.55 }}>
          This Mac runs models on its CPU, so larger local models answer much more slowly. Remote models need working credentials in OpenClaw.
        </div>
        {loading && !models.length && <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8 }}>Loading models…</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {models.map(m => {
            const active = m.id === current;
            return (
              <button key={m.id} className="tap card" onClick={() => !active && setConfirm(m)}
                style={{ padding: 14, textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%",
                  border: active ? "1px solid var(--accent)" : undefined }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple)", flexShrink: 0 }}>
                  <Icon name="brain" size={19} stroke={1.9} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono clip" style={{ fontSize: 13.5, fontWeight: 640 }}>{m.id}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{m.family} · {m.ctx} context</div>
                </div>
                {active ? <Pill tone="ok"><Dot size={5} color="var(--ok)" pulse />Default</Pill> : <Icon name="chevR" size={17} style={{ color: "var(--text-ghost)" }} />}
              </button>
            );
          })}
        </div>
      </div>
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="Switch default model?">
        <p style={{ fontSize: 14, color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
          Agents that don't set their own model will use <span className="mono">{confirm?.id}</span> instead of <span className="mono">{current}</span>.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Btn full variant="glass" onClick={() => setConfirm(null)}>Cancel</Btn>
          <Btn full disabled={setModel.isPending} onClick={() => confirm && setModel.mutate(confirm.id, { onSettled: () => setConfirm(null) })}>
            {setModel.isPending ? "Switching…" : "Switch"}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}
