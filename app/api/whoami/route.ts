import { currentDevice } from "@/lib/server/device-request";
import { isRemote, view } from "@/lib/server/devices";
import { handle } from "@/lib/server/http";
import { appInfo } from "@/lib/server/insights";

export const dynamic = "force-dynamic";

export const GET = handle((req) => {
  const device = currentDevice(req);
  return {
    ...appInfo(),
    remote: isRemote(req.headers),
    device: device ? view(device, device) : null,
    // Set by Cloudflare Access on tunneled requests
    email: req.headers.get("cf-access-authenticated-user-email"),
  };
});
