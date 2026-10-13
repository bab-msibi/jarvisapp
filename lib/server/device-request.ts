import type { NextRequest } from "next/server";
import { DEVICE_COOKIE, deviceFor } from "./devices";

// The device making this request (null on this Mac or for unknown devices)
export const currentDevice = (req: NextRequest) => deviceFor(req.cookies.get(DEVICE_COOKIE)?.value);
