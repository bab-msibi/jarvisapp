"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/primitives";
import { apiGet } from "@/lib/api";
import { appendMessage, removePending, usePendingReplies, type PendingReply } from "@/lib/chat-store";
import { useData, type ChatJob } from "@/lib/queries";

export interface ReplyToast { id: string; agentId: string; title: string; body: string; error: boolean }

// System notification while Jarvis is in the background (needs permission, which
// the chat asks for on the first message). Uses the service worker, which is the
// only way that works on Android.
async function notifySystem(t: ReplyToast, url: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    await reg?.showNotification(t.title, { body: t.body, tag: `chat-${t.agentId}`, data: { url }, icon: "/icon-192.png" });
  } catch {}
}

// Polls every waiting reply; when one finishes, saves it into its conversation
// and raises a notice — wherever you are in the app, and after reloads.
export function ChatReplyWatcher({ activeChatAgentId, onToast, chatUrl }: {
  activeChatAgentId: string | null;
  onToast: (t: ReplyToast) => void;
  chatUrl: (agentId: string) => string;
}) {
  const pending = usePendingReplies();
  const { agents } = useData();
  const results = useQueries({
    queries: pending.map((p) => ({
      queryKey: ["chatJob", p.jobId],
      queryFn: () => apiGet<{ job: ChatJob }>(`/api/agent/chat/jobs/${p.jobId}`),
      refetchInterval: 2000,
      retry: false,
    })),
  });

  useEffect(() => {
    results.forEach((r, i) => {
      const p: PendingReply | undefined = pending[i];
      if (!p) return;
      const job = r.data?.job;
      const lost = r.isError; // 404: the server restarted while waiting
      if (!lost && (!job || job.status === "running")) return;

      const ok = job?.status === "done";
      const text = ok ? job!.reply ?? "" : lost ? "This reply was lost because Jarvis restarted while waiting. Please send your message again." : job?.error ?? "Agent error";
      appendMessage(p.agentId, p.sessionId, { role: "agent", text, id: Date.now(), model: ok ? job!.usedModel : null, error: !ok });
      removePending(p.jobId);

      if (p.agentId === activeChatAgentId && !document.hidden) return; // already looking at it
      const name = agents.find((a) => a.id === p.agentId)?.name ?? p.agentId;
      const t: ReplyToast = {
        id: p.jobId, agentId: p.agentId, error: !ok,
        title: ok ? `${name} replied` : `${name} couldn't reply`,
        body: text.replace(/\s+/g, " ").slice(0, 140),
      };
      onToast(t);
      void notifySystem(t, chatUrl(p.agentId));
    });
  });

  return null;
}

export function ReplyToasts({ toasts, onOpen, onDismiss }: {
  toasts: ReplyToast[]; onOpen: (t: ReplyToast) => void; onDismiss: (id: string) => void;
}) {
  return (
    <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 0, right: 0, zIndex: 400,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 12px", pointerEvents: "none" }}>
      {toasts.map((t) => (
        <AutoDismiss key={t.id} onDone={() => onDismiss(t.id)}>
          <div className="glass" style={{ pointerEvents: "auto", width: "100%", maxWidth: 420, borderRadius: 16, padding: "11px 12px 11px 14px",
            display: "flex", alignItems: "center", gap: 11, background: "var(--surface-solid)", boxShadow: "0 8px 30px rgba(0,0,0,0.35)", animation: "popIn .3s" }}>
            <Icon name={t.error ? "warn" : "message"} size={18} stroke={2} style={{ color: t.error ? "var(--err)" : "var(--accent)", flexShrink: 0 }} />
            <button className="tap" onClick={() => onOpen(t)} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 13.5, fontWeight: 650 }}>{t.title}</div>
              <div className="clip" style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 1 }}>{t.body}</div>
            </button>
            <button className="tap" onClick={() => onDismiss(t.id)} aria-label="Dismiss" style={{ color: "var(--text-ghost)", padding: 4 }}><Icon name="x" size={15} /></button>
          </div>
        </AutoDismiss>
      ))}
    </div>
  );
}

function AutoDismiss({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover) return;
    const t = setTimeout(onDone, 8000);
    return () => clearTimeout(t);
  }, [hover, onDone]);
  return <div style={{ width: "100%", display: "flex", justifyContent: "center" }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{children}</div>;
}
