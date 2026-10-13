import { currentDevice } from "@/lib/server/device-request";
import { isRemote, view } from "@/lib/server/devices";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = handle((req) => {
  if (!isRemote(req.headers)) return { status: "local" };
  const device = currentDevice(req);
  return device ? view(device, device) : { status: "none" };
});
