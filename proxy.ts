import fs from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, deviceFor, isRemote, touch } from "@/lib/server/devices";

// Reachable by devices that haven't been approved yet
const PAIRING_ROUTES = new Set(["/api/devices/me", "/api/devices/request"]);
const PAIRING_PAGE = path.join(process.cwd(), "pairing.html");

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // A JSON content type can't be sent cross-site without a CORS preflight, which we never grant,
  // so other websites can't drive /api/exec through the user's browser
  if (req.method === "POST" && pathname.startsWith("/api/") && !req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  // Tunneled requests must come from an approved device; this Mac is always trusted
  if (!isRemote(req.headers)) return NextResponse.next();
  const device = deviceFor(req.cookies.get(DEVICE_COOKIE)?.value);
  if (device) touch(device, req.headers);
  if (device?.status === "approved" || PAIRING_ROUTES.has(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Device not approved" }, { status: 401 });
  }
  // 401 keeps the service worker from caching the pairing page as the app
  return new NextResponse(fs.readFileSync(PAIRING_PAGE), {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const config = { matcher: "/:path*" };
