import { handle, HttpError, readJson } from "@/lib/server/http";
import { agentRun } from "@/lib/server/openclaw";

export const dynamic = "force-dynamic";
export const maxDuration = 630;

export const POST = handle(async (req) => {
  const { prompt, agentId } = await readJson<{ prompt?: unknown; agentId?: unknown }>(req);
  if (!prompt || typeof prompt !== "string") throw new HttpError(400, "prompt required");
  return agentRun(prompt, typeof agentId === "string" ? agentId : undefined);
});
