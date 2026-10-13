import { invalidate } from "@/lib/server/cache";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { setDefaultModel } from "@/lib/server/insights";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const { model } = await readJson<{ model?: unknown }>(req);
  if (typeof model !== "string" || !model) throw new HttpError(400, "model required");
  const config = await setDefaultModel(model);
  invalidate("modelConfig", "models", "status", "agents");
  return config;
});
