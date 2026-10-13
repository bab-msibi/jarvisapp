import { execFile } from "node:child_process";
import { isRemote } from "@/lib/server/devices";
import { resolveFile } from "@/lib/server/files";
import { handle, HttpError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Selects the file in a Finder window on this Mac — pointless (and surprising) from a remote device
export const POST = handle(async (req) => {
  if (isRemote(req.headers)) throw new HttpError(403, "Reveal in Finder only works on this Mac");
  const { id } = await readJson<{ id?: unknown }>(req);
  if (typeof id !== "string") throw new HttpError(400, "id required");
  const file = await resolveFile(id);
  await new Promise<void>((resolve, reject) =>
    execFile("open", ["-R", file.fullPath], (err) => (err ? reject(new HttpError(500, err.message)) : resolve())));
  return { ok: true };
});
