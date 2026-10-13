import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, DEVICE_COOKIE, isRemote, requestAccess, view } from "@/lib/server/devices";
import { HttpError, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isRemote(req.headers)) throw new HttpError(400, "This Mac doesn't need approval");
    const body = await readJson<{ name?: unknown }>(req);
    const { device, token } = requestAccess(req.cookies.get(DEVICE_COOKIE)?.value, req.headers, body.name);
    const res = NextResponse.json(view(device, device));
    if (token) res.cookies.set(DEVICE_COOKIE, token, cookieOptions);
    return res;
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message || "Internal error" }, { status: err.status || 500 });
  }
}
