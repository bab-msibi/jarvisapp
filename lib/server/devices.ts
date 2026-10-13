// Device whitelist for remote (tunneled) access.
// Requests that arrive through Cloudflare Tunnel must carry a cookie for an
// approved device; unknown devices can only request access and wait for approval.
// Requests made directly on this Mac are always trusted.
//
// proxy.ts and the route handlers are separate bundles with separate memory, so the
// list is re-read whenever devices.json changes on disk.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HttpError } from "./http";

const FILE = path.join(process.cwd(), "devices.json");
export const DEVICE_COOKIE = "jarvis_device";
const MAX_PENDING = 20;
const PENDING_TTL = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export interface Device {
  id: string; name: string; status: "pending" | "approved"; code: string; tokenHash: string;
  userAgent: string; ip: string | null; email: string | null;
  createdAt: number; approvedAt: number | null; lastSeen: number;
}

let state: { devices: Device[] } = { devices: [] };
let loadedMtime = -1;
let lastSave = 0;

function sync() {
  let mtime = 0;
  try { mtime = fs.statSync(FILE).mtimeMs; } catch {}
  if (mtime === loadedMtime) return;
  loadedMtime = mtime;
  try {
    const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
    state = { devices: Array.isArray(d.devices) ? d.devices : [] };
  } catch {
    state = { devices: [] };
  }
}

function save() {
  lastSave = Date.now();
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  loadedMtime = fs.statSync(FILE).mtimeMs;
}

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// The server binds to 127.0.0.1 only; cloudflared's proxy headers mark a request as remote
export function isRemote(headers: Headers) {
  if (headers.get("cf-connecting-ip") || headers.get("cf-ray")) return true;
  const xff = headers.get("x-forwarded-for");
  return !!xff && xff.split(",").some((ip) => !LOOPBACK.has(ip.trim()));
}

function clientIp(headers: Headers) {
  return headers.get("cf-connecting-ip") || (headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
}

export function deviceFor(token: string | undefined) {
  if (!token) return null;
  sync();
  const h = hash(token);
  return state.devices.find((d) => d.tokenHash === h) || null;
}

export function touch(device: Device, headers: Headers) {
  device.lastSeen = Date.now();
  device.ip = clientIp(headers);
  const email = headers.get("cf-access-authenticated-user-email");
  if (email) device.email = email;
  if (Date.now() - lastSave > 60000) save(); // throttle disk writes
}

function prunePending() {
  const cutoff = Date.now() - PENDING_TTL;
  state.devices = state.devices.filter((d) => d.status !== "pending" || d.createdAt > cutoff);
}

function newCode() {
  return Array.from(crypto.randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

// Returns the token only when a new device was created
export function requestAccess(token: string | undefined, headers: Headers, name: unknown) {
  const existing = deviceFor(token);
  if (existing) return { device: existing, token: null };
  sync();
  prunePending();
  if (state.devices.filter((d) => d.status === "pending").length >= MAX_PENDING) {
    throw new HttpError(429, "Too many pending device requests — approve or deny some first");
  }
  const newToken = crypto.randomBytes(32).toString("base64url");
  const device: Device = {
    id: crypto.randomBytes(8).toString("hex"),
    name: String(name || "Unnamed device").slice(0, 60),
    status: "pending",
    code: newCode(),
    tokenHash: hash(newToken),
    userAgent: (headers.get("user-agent") || "").slice(0, 300),
    ip: clientIp(headers),
    email: headers.get("cf-access-authenticated-user-email"),
    createdAt: Date.now(),
    approvedAt: null,
    lastSeen: Date.now(),
  };
  state.devices.push(device);
  save();
  return { device, token: newToken };
}

function find(id: string) {
  sync();
  const d = state.devices.find((x) => x.id === id);
  if (!d) throw new HttpError(404, "Device not found");
  return d;
}

export function approve(id: string) {
  const d = find(id);
  d.status = "approved";
  d.approvedAt = Date.now();
  save();
  return d;
}

export function remove(id: string) {
  find(id);
  state.devices = state.devices.filter((d) => d.id !== id);
  save();
}

export function rename(id: string, name: unknown) {
  const d = find(id);
  d.name = String(name || d.name).slice(0, 60);
  save();
  return d;
}

export const view = (d: Device, current: Device | null) => ({
  id: d.id, name: d.name, status: d.status, code: d.code, userAgent: d.userAgent, ip: d.ip,
  email: d.email, createdAt: d.createdAt, approvedAt: d.approvedAt, lastSeen: d.lastSeen,
  current: !!current && current.id === d.id,
});

export function list(current: Device | null) {
  sync();
  prunePending();
  return state.devices.map((d) => view(d, current));
}

export const cookieOptions = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: true, maxAge: 31536000 };
