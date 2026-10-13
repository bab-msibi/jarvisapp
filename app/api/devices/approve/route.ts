import { currentDevice } from "@/lib/server/device-request";
import { approve, view } from "@/lib/server/devices";
import { handle, HttpError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const { id } = await readJson<{ id?: unknown }>(req);
  if (typeof id !== "string") throw new HttpError(400, "id required");
  return view(approve(id), currentDevice(req));
});
