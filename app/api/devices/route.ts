import { currentDevice } from "@/lib/server/device-request";
import { list } from "@/lib/server/devices";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Managing the whitelist is gated by proxy.ts: only this Mac or an approved device gets here
export const GET = handle((req) => ({ devices: list(currentDevice(req)) }));
