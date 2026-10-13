// Device whitelist for remote (tunneled) access.
// Requests that arrive through Cloudflare Tunnel must carry a cookie for an
// approved device; unknown devices can only request access and wait for approval.
// Direct loopback requests (this Mac) are always trusted.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = path.join(__dirname, "devices.json");
const COOKIE = "jarvis_device";
const MAX_PENDING = 20;
const PENDING_TTL = 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

let state = load();
let lastSave = 0;

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return { devices: Array.isArray(d.devices) ? d.devices : [] };
  } catch {
    return { devices: [] };
  }
}

function save() {
  lastSave = Date.now();
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// cloudflared connects from localhost, so the proxy headers are what mark a request as remote
function isRemote(req) {
  const addr = req.socket.remoteAddress || "";
  const loopback = addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  const proxied = req.headers["cf-connecting-ip"] || req.headers["cf-ray"] || req.headers["x-forwarded-for"];
  return !loopback || !!proxied;
}

function clientIp(req) {
  return req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
}

function deviceFor(req) {
  const token = cookies(req)[COOKIE];
  if (!token) return null;
  const h = hash(token);
  return state.devices.find(d => d.tokenHash === h) || null;
}

function touch(device, req) {
  device.lastSeen = Date.now();
  device.ip = clientIp(req);
  const email = req.headers["cf-access-authenticated-user-email"];
  if (email) device.email = email;
  if (Date.now() - lastSave > 60000) save(); // throttle disk writes
}

function prunePending() {
  const cutoff = Date.now() - PENDING_TTL;
  state.devices = state.devices.filter(d => d.status !== "pending" || d.createdAt > cutoff);
}

function newCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

// Returns { device, token } — token is only set when a new device was created
function requestAccess(req, name) {
  const existing = deviceFor(req);
  if (existing) return { device: existing, token: null };
  prunePending();
  if (state.devices.filter(d => d.status === "pending").length >= MAX_PENDING) {
    const e = new Error("Too many pending device requests — approve or deny some first");
    e.status = 429;
    throw e;
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const device = {
    id: crypto.randomBytes(8).toString("hex"),
    name: String(name || "Unnamed device").slice(0, 60),
    status: "pending",
    code: newCode(),
    tokenHash: hash(token),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    ip: clientIp(req),
    email: req.headers["cf-access-authenticated-user-email"] || null,
    createdAt: Date.now(),
    approvedAt: null,
    lastSeen: Date.now(),
  };
  state.devices.push(device);
  save();
  return { device, token };
}

function find(id) {
  const d = state.devices.find(x => x.id === id);
  if (!d) { const e = new Error("Device not found"); e.status = 404; throw e; }
  return d;
}

function approve(id) {
  const d = find(id);
  d.status = "approved";
  d.approvedAt = Date.now();
  save();
  return d;
}

function remove(id) {
  find(id);
  state.devices = state.devices.filter(d => d.id !== id);
  save();
}

function rename(id, name) {
  const d = find(id);
  d.name = String(name || d.name).slice(0, 60);
  save();
  return d;
}

const view = (d, current) => ({
  id: d.id, name: d.name, status: d.status, code: d.code, userAgent: d.userAgent, ip: d.ip,
  email: d.email, createdAt: d.createdAt, approvedAt: d.approvedAt, lastSeen: d.lastSeen,
  current: !!current && current.id === d.id,
});

function list(current) {
  prunePending();
  return state.devices.map(d => view(d, current));
}

function cookieHeader(token, secure) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? "; Secure" : ""}`;
}

module.exports = { isRemote, deviceFor, touch, requestAccess, approve, remove, rename, list, view, cookieHeader };
