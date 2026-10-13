import { handle, HttpError, readJson } from "@/lib/server/http";
import { agentChat } from "@/lib/server/openclaw";

export const dynamic = "force-dynamic";
export const maxDuration = 630;

export const POST = handle(async (req) => {
  const { agentId, message, sessionKey } = await readJson<{ agentId?: unknown; message?: unknown; sessionKey?: unknown }>(req);
  if (!message || typeof message !== "string") throw new HttpError(400, "message required");
  if (!agentId || typeof agentId !== "string") throw new HttpError(400, "agentId required");
  return agentChat(agentId, message, typeof sessionKey === "string" ? sessionKey : undefined);
});
