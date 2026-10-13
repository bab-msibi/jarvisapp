"use client";

// Notifications = server-side items (devices, tasks, cron, gateway, tunnel) plus
// agent replies you haven't read. "Seen" ids are remembered per browser so the
// bell only shows a badge for things that are new since you last looked.
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { apiGet } from "./api";
import { useUnreadReplies } from "./chat-store";
import { useData } from "./queries";
import type { Notification } from "./server/notifications";

export type { Notification };

const SEEN_KEY = "jarvis:notifications:seen";
let seen: Set<string> | null = null;
const listeners = new Set<() => void>();

function getSeen() {
  if (!seen) {
    try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { seen = new Set(); }
  }
  return seen;
}

export function markSeen(ids: string[]) {
  const next = new Set(getSeen());
  ids.forEach((id) => next.add(id));
  seen = next;
  // Keep the stored list bounded to what's still current plus recent history
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-500))); } catch {}
  listeners.forEach((l) => l());
}

const useSeen = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, getSeen, getSeen);

export function useNotifications() {
  const server = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<{ notifications: Notification[] }>("/api/notifications"),
    refetchInterval: 30000,
  });
  const replies = useUnreadReplies();
  const { agents } = useData();
  const seenIds = useSeen();

  const replyItems: Notification[] = replies.map((r) => {
    const name = agents.find((a) => a.id === r.agentId)?.name ?? r.agentId;
    return {
      id: `reply:${r.jobId}`, severity: r.error ? "err" : "info", icon: "message",
      title: r.error ? `${name} couldn't reply` : `${name} replied`, text: r.preview, at: r.at,
      link: `/agents/agent/${encodeURIComponent(r.agentId)}/chat/${encodeURIComponent(r.agentId)}`,
    };
  });
  const items = [...replyItems, ...(server.data?.notifications ?? [])].sort((a, b) => b.at - a.at);
  const unseen = items.filter((n) => !seenIds.has(n.id));
  return { items, unseen, isSeen: (id: string) => seenIds.has(id), loading: server.isPending, error: server.error };
}
