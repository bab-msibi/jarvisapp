import { cronAction } from "@/lib/server/cron";
import { handle, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// POST { id, action: "run" | "enable" | "disable" | "model", model? }
export const POST = handle(async (req) => cronAction(await readJson(req)));
