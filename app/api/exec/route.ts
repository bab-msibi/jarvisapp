import { handle, HttpError, readJson } from "@/lib/server/http";
import { execCommand } from "@/lib/server/terminal";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const { command } = await readJson<{ command?: unknown }>(req);
  if (typeof command !== "string" || !command.trim()) throw new HttpError(400, "command required");
  return execCommand(command);
});
