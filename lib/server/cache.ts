// In-memory response cache — the openclaw CLI has a ~15s cold start
type Entry = { ts: number; data: unknown; pending?: Promise<unknown> };

const g = globalThis as typeof globalThis & { __jarvisCache?: Map<string, Entry> };
const CACHE = (g.__jarvisCache ??= new Map());

export function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data as T);
  // Deduplicate in-flight requests for the same key
  if (hit?.pending) return hit.pending as Promise<T>;
  const promise = fn()
    .then((data) => {
      CACHE.set(key, { ts: Date.now(), data });
      return data;
    })
    .catch((e) => {
      CACHE.delete(key);
      throw e;
    });
  CACHE.set(key, { ts: 0, data: null, pending: promise });
  return promise;
}

export function invalidate(...keys: string[]) {
  keys.forEach((k) => CACHE.delete(k));
}
