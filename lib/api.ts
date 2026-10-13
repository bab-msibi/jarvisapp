export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

// POSTs must be JSON — the server rejects anything else to block cross-site requests
export async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await errorMessage(r));
  return r.json();
}

async function errorMessage(r: Response) {
  try {
    const d = await r.json();
    if (d?.error) return String(d.error);
  } catch {}
  return `HTTP ${r.status}`;
}

export function relTime(ms?: number | null) {
  if (!ms) return "–";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
