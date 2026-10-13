import { currentDevice } from "@/lib/server/device-request";
import { rename, view } from "@/lib/server/devices";
import { handle, HttpError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const { id, name } = await readJson<{ id?: unknown; name?: unknown }>(req);
  if (typeof id !== "string") throw new HttpError(400, "id required");
  return view(rename(id, name), currentDevice(req));
});
