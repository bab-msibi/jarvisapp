import { startChatJob } from "@/lib/server/chat-jobs";
import { peek } from "@/lib/server/cache";
import { handle, HttpError, readJson } from "@/lib/server/http";
import type { modelConfig } from "@/lib/server/insights";
import { agentChat } from "@/lib/server/openclaw";

type ModelConfig = Awaited<ReturnType<typeof modelConfig>>;

export const dynamic = "force-dynamic";
export const maxDuration = 630;

// { agentId, message, sessionKey?, model?, async? }
// async: true starts a background job and returns it immediately (poll /api/agent/chat/jobs/<id>);
// otherwise the reply is returned when the turn finishes (used by the MCP server).
export const POST = handle(async (req) => {
  const { agentId, message, sessionKey, model, async } = await readJson<{
    agentId?: unknown; message?: unknown; sessionKey?: unknown; model?: unknown; async?: unknown;
  }>(req);
  if (!message || typeof message !== "string") throw new HttpError(400, "message required");
  if (!agentId || typeof agentId !== "string") throw new HttpError(400, "agentId required");
  if (model !== undefined && typeof model !== "string") throw new HttpError(400, "model must be a string");
  if (model) {
    // A plain model id (provider/name[:tag]) — never something the CLI could read as a flag
    if (!/^[A-Za-z0-9][\w.:/-]*$/.test(model)) throw new HttpError(400, "Invalid model id");
    // Check the allowlist when it's cached; on a cold start don't make the user wait for
    // `openclaw models status` — OpenClaw itself rejects models outside the allowlist
    const cfg = peek<ModelConfig>("modelConfig");
    if (cfg && !cfg.chatModels.includes(model)) throw new HttpError(400, `Model not allowed for chat: ${model}`);
  }
  const key = typeof sessionKey === "string" ? sessionKey : undefined;
  const m = (model as string | undefined) || undefined;
  if (async === true) return { job: startChatJob(agentId, message, key, m) };
  return agentChat(agentId, message, key, m);
});
