// Cached read-only endpoints, shared by the route handlers and the startup warm-up
import { cached } from "./cache";
import { listAgents, listModels, oc } from "./openclaw";
import { systemStats } from "./system";

const ENDPOINTS = {
  agents: { ttl: 20000, load: listAgents },
  tasks: { ttl: 20000, load: () => oc(["tasks", "list", "--json"]) },
  sessions: { ttl: 20000, load: () => oc(["sessions", "list", "--json"]) },
  cron: { ttl: 20000, load: () => oc(["cron", "list", "--json"]) },
  status: { ttl: 20000, load: () => oc(["status", "--json"]) },
  models: { ttl: 20000, load: listModels },
  system: { ttl: 10000, load: systemStats },
};

export type EndpointName = keyof typeof ENDPOINTS;

export function getCached<K extends EndpointName>(name: K): ReturnType<(typeof ENDPOINTS)[K]["load"]> {
  const { ttl, load } = ENDPOINTS[name];
  return cached(name, ttl, load as () => Promise<unknown>) as ReturnType<(typeof ENDPOINTS)[K]["load"]>;
}

// Pre-warm in the background so the first page load is fast
export function warmCache() {
  for (const name of Object.keys(ENDPOINTS) as EndpointName[]) {
    getCached(name)
      .then(() => console.log(`[cache] warmed /api/${name}`))
      .catch((e: Error) => console.log(`[cache] /api/${name} failed: ${e.message}`));
  }
}
