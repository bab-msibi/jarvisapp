#!/usr/bin/env node
// Jarvis PWA — local API bridge for OpenClaw
// Usage: node server.js
// Serves the PWA at http://127.0.0.1:3000 and provides real OpenClaw data via /api/*

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const PORT = 3000;
const DIR = __dirname;
const OPENCLAW = "openclaw";
const EXEC_OPTS = { timeout: 30000, maxBuffer: 1024 * 1024 * 4 };

// Simple in-memory cache — openclaw CLI takes ~15s cold start, so cache results
const CACHE = new Map();
const CACHE_TTL = { default: 20000, "/api/system": 10000, "/api/files": 30000 };

function cached(key, ttl, fn) {
  const now = Date.now();
  const hit = CACHE.get(key);
  if (hit && now - hit.ts < ttl) return Promise.resolve(hit.data);
  // Deduplicate in-flight requests for the same key
  if (hit && hit.pending) return hit.pending;
  const promise = fn().then(data => {
    CACHE.set(key, { ts: Date.now(), data });
    return data;
  }).catch(e => {
    CACHE.delete(key);
    throw e;
  });
  CACHE.set(key, { ts: 0, data: null, pending: promise });
  return promise;
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

async function oc(args) {
  const { stdout } = await execFileAsync(OPENCLAW, args, EXEC_OPTS);
  return JSON.parse(stdout);
}

// --- API handlers ---
const API = {
  "/api/status": async () => oc(["status", "--json"]),

  "/api/agents": async () => {
    const list = await oc(["agents", "list", "--json"]);
    return { agents: Array.isArray(list) ? list : (list.agents ?? []) };
  },

  "/api/tasks": async () => oc(["tasks", "list", "--json"]),

  "/api/sessions": async () => oc(["sessions", "list", "--json"]),

  "/api/models": async () => {
    const { stdout } = await execFileAsync(OPENCLAW, ["models", "list"], EXEC_OPTS);
    // Strip ANSI escape codes from the output
    const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, "");
    const clean = stripAnsi(stdout);
    const [header, ...rows] = clean.trim().split("\n");
    // Find column start positions from header
    const cols = ["Model", "Input", "Ctx", "Local", "Auth", "Tags"];
    const pos = cols.map(c => header.indexOf(c));
    const models = rows.filter(r => r.trim()).map(line => {
      const get = (i) => {
        const start = pos[i];
        const end = pos[i + 1] ?? line.length;
        return line.slice(start, end).trim();
      };
      const key = get(0);
      const ctx = get(2);
      const ctxN = parseFloat(ctx) * (ctx.toLowerCase().endsWith("k") ? 1000 : 1);
      const tags = get(5).split(",").map(t => t.trim()).filter(Boolean);
      return {
        key, name: key.replace(/^[^/]+\//, ""),
        input: get(1), contextWindow: isNaN(ctxN) ? 0 : Math.round(ctxN),
        local: get(3).toLowerCase() === "yes", available: true, tags,
      };
    }).filter(m => m.key);
    return { models };
  },

  "/api/cron": async () => oc(["cron", "list", "--json"]),

  "/api/market": async () => {
    // Seeded pseudo-random walk for consistent paper-trading simulation
    function seededRand(seed) {
      let s = seed;
      return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    }

    function buildSeries({ name, baseSeed, startPrice, dailyVol, days = 60 }) {
      const rand = seededRand(baseSeed);
      const now = new Date();
      const prices = [], dates = [];
      let price = startPrice;
      // Walk backwards then build forward
      const series = [];
      for (let i = days; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
        const change = (rand() - 0.48) * dailyVol; // slight upward drift
        price = Math.max(price * (1 + change), price * 0.8);
        series.push({ date: d.toISOString().slice(0, 10), close: Math.round(price * 100) / 100 });
      }
      // Add intraday movement for "today"
      const hourFrac = (new Date().getHours() + new Date().getMinutes() / 60) / 24;
      const todayRand = seededRand(baseSeed + Math.floor(Date.now() / 60000)); // changes per minute
      const intradayMove = (todayRand() - 0.48) * dailyVol * 0.7 * hourFrac;
      const last = series[series.length - 1];
      const current = Math.round(last.close * (1 + intradayMove) * 100) / 100;
      const prevClose = series.length >= 2 ? series[series.length - 2].close : last.close;
      const change = current - prevClose;
      const changePct = prevClose ? (change / prevClose) * 100 : 0;
      const todayHigh = Math.max(current, last.close) * (1 + dailyVol * 0.3);
      const todayLow = Math.min(current, last.close) * (1 - dailyVol * 0.3);
      return {
        name,
        current: Math.round(current * 100) / 100,
        prevClose,
        change: parseFloat(change.toFixed(2)),
        changePct: parseFloat(changePct.toFixed(2)),
        high: Math.round(todayHigh * 100) / 100,
        low: Math.round(todayLow * 100) / 100,
        prices: series.map(s => s.close),
        dates: series.map(s => s.date),
        simulated: true,
      };
    }

    return {
      dax: buildSeries({ name: "DAX 40",  baseSeed: 0x44415831, startPrice: 22800, dailyVol: 0.012 }),
      nasdaq: buildSeries({ name: "NASDAQ", baseSeed: 0x4e445131, startPrice: 18900, dailyVol: 0.015 }),
      updatedAt: Date.now(),
    };
  },

  "/api/files": async (params) => {
    const fsP = require("fs").promises;
    const pathM = require("path");
    const os = require("os");
    const HOME = os.homedir();
    // Scan the agent workspace AND the user's common folders so "Recent Files"
    // reflects actual recent activity (screenshots, downloads, docs).
    const ROOTS = [
      { label: "Desktop",   dir: pathM.join(HOME, "Desktop"),   depth: 3 },
      { label: "Downloads", dir: pathM.join(HOME, "Downloads"), depth: 3 },
      { label: "Documents", dir: pathM.join(HOME, "Documents"), depth: 3 },
      { label: "Pictures",  dir: pathM.join(HOME, "Pictures"),  depth: 3 },
      { label: "Workspace", dir: "/Users/admin/.openclaw/workspace", depth: 6 },
    ];
    const IGNORE = new Set([".git", ".obsidian", ".DS_Store", "node_modules", ".tmp", "Photos Library.photoslibrary"]);
    const q = (params?.q || "").toLowerCase();
    const folder = params?.folder || ""; // source label, e.g. "Desktop"
    const limit = Math.min(parseInt(params?.limit) || 50, 200);

    // Walk a root directory, collect files tagged with their source root
    const files = [];
    async function walk(dir, root, depth) {
      if (depth > root.depth) return;
      let entries;
      try { entries = await fsP.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
        const full = pathM.join(dir, e.name);
        if (e.isDirectory()) {
          await walk(full, root, depth + 1);
        } else {
          try {
            const st = await fsP.stat(full);
            const relToRoot = pathM.relative(root.dir, full);
            const sub = pathM.dirname(relToRoot);
            const ext = pathM.extname(e.name).replace(".", "").toLowerCase();
            const sizeKb = Math.round(st.size / 1024);
            const sizeStr = st.size > 1048576 ? `${(st.size/1048576).toFixed(1)} MB`
              : st.size > 1024 ? `${Math.round(st.size/1024)} KB`
              : `${st.size} B`;
            files.push({
              id: `${root.label}/${relToRoot}`, name: e.name,
              path: sub === "." ? e.name : relToRoot,
              source: root.label,
              dir: sub === "." ? root.label : `${root.label}/${sub}`,
              fullPath: full,
              ext: ext || "file", sizeStr, sizeKb,
              modified: st.mtimeMs,
            });
          } catch {}
        }
      }
    }

    await Promise.all(ROOTS.map(r => walk(r.dir, r, 0)));

    // Sort by most recently modified
    files.sort((a, b) => b.modified - a.modified);

    // Filter by source folder, then search query
    let filtered = files;
    if (folder) filtered = filtered.filter(f => f.source === folder);
    if (q) filtered = filtered.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));

    // Top folders = source roots with counts (stable chips)
    const sourceCounts = {};
    files.forEach(f => { sourceCounts[f.source] = (sourceCounts[f.source] || 0) + 1; });
    const folders = ROOTS
      .map(r => ({ name: r.label, count: sourceCounts[r.label] || 0 }))
      .filter(f => f.count > 0);

    // Disk usage
    const totalBytes = files.reduce((s, f) => s + (f.sizeKb * 1024), 0);
    const totalMb = (totalBytes / 1048576).toFixed(0);

    return {
      files: filtered.slice(0, limit),
      total: filtered.length,
      allTotal: files.length,
      folders,
      workspaceMb: totalMb,
      workspace: HOME,
    };
  },

  "/api/system": async () => {
    const os = require("os");
    const { execFile: ef } = require("child_process");
    const run = (cmd, args, opts = {}) => new Promise((res, rej) => {
      ef(cmd, args, { timeout: 5000, maxBuffer: 1024 * 256, ...opts }, (err, out) => err ? rej(err) : res(out.trim()));
    });

    const [cpuLine, vmStat, dfOut, swVers, battOut, modelStr, loadStr, netOut] = await Promise.all([
      run("bash", ["-c", "top -l 1 -n 0 | grep 'CPU usage'"]),
      run("vm_stat", []),
      run("df", ["-k", "/"]),
      run("sw_vers", []),
      run("pmset", ["-g", "batt"]),
      run("sysctl", ["-n", "hw.model"]),
      run("sysctl", ["-n", "vm.loadavg"]),
      run("netstat", ["-ib"]).catch(() => ""),
    ]);

    // CPU %
    const cpuM = cpuLine.match(/([\d.]+)% user.*?([\d.]+)% sys.*?([\d.]+)% idle/);
    const cpuUser = cpuM ? parseFloat(cpuM[1]) : 0;
    const cpuSys = cpuM ? parseFloat(cpuM[2]) : 0;
    const cpuIdle = cpuM ? parseFloat(cpuM[3]) : 100;
    const cpuPct = Math.round(cpuUser + cpuSys);

    // RAM from vm_stat
    const pageSize = 4096;
    const vmNum = (key) => { const m = vmStat.match(new RegExp(key + ":\\s+(\\d+)")); return m ? parseInt(m[1]) * pageSize : 0; };
    const totalRam = os.totalmem();
    const freeRam = vmNum("Pages free") + vmNum("Pages speculative");
    const usedRam = totalRam - freeRam;
    const ramPct = Math.round((usedRam / totalRam) * 100);

    // Disk
    const dfLine = dfOut.split("\n").slice(1)[0] || "";
    const dfParts = dfLine.trim().split(/\s+/);
    const diskTotalKb = parseInt(dfParts[1]) || 0;
    const diskUsedKb = parseInt(dfParts[2]) || 0;
    const diskPct = diskTotalKb ? Math.round((diskUsedKb / diskTotalKb) * 100) : 0;
    const gb = kb => (kb / 1024 / 1024).toFixed(0);

    // macOS version
    const osVersion = (swVers.match(/ProductVersion:\s+(.+)/) || [])[1] || "macOS";

    // Uptime
    const uptimeSec = Math.floor(os.uptime());
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const uptime = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;

    // Battery
    const battLine = battOut.split("\n").find(l => l.includes("InternalBattery")) || "";
    const battPct = (battLine.match(/(\d+)%/) || [])[1];
    const charging = battLine.includes("charging") || battLine.includes("charged");
    const battStatus = battLine.includes("charged") ? "AC Power · Charged"
      : battLine.includes("charging") ? `AC Power · Charging ${battPct}%`
      : battPct ? `${battPct}% · On Battery` : "AC Power";

    // Load avg
    const loadNums = (loadStr.match(/[\d.]+/g) || []).slice(0, 3);
    const load1 = parseFloat(loadNums[0]) || 0;

    // Network IP
    const ip = (() => { try { const ifaces = os.networkInterfaces(); for (const name of ["en0","en1","eth0"]) { const i = ifaces[name]?.find(a => a.family === "IPv4" && !a.internal); if (i) return i.address; } return "–"; } catch { return "–"; } })();

    // Network bytes (en0 from netstat -ib)
    const netLine = netOut.split("\n").find(l => /^en0\s/.test(l) && l.includes(".")) || "";
    const netParts = netLine.trim().split(/\s+/);
    const netIn = parseInt(netParts[6]) || 0;
    const netOut2 = parseInt(netParts[9]) || 0;

    // CPU info
    const cpuModel = (() => { try { return require("child_process").execSync("sysctl -n machdep.cpu.brand_string", {timeout:2000}).toString().trim(); } catch { return "Unknown CPU"; } })();
    const cpuCores = os.cpus().length;

    // GPU (best effort)
    const gpuInfo = await run("bash", ["-c", "system_profiler SPDisplaysDataType 2>/dev/null | grep -E 'Chipset Model|VRAM' | head -4"]).catch(() => "");
    const gpus = [];
    gpuInfo.split("\n").forEach(l => { if (l.includes("Chipset")) gpus.push(l.replace(/.*Chipset Model:\s*/,"").trim()); });

    const model = modelStr.trim();
    const friendlyModel = model.startsWith("MacBookPro") ? "MacBook Pro" : model.startsWith("MacBookAir") ? "MacBook Air"
      : model.startsWith("MacPro") ? "Mac Pro" : model.startsWith("MacStudio") ? "Mac Studio"
      : model.startsWith("Macmini") ? "Mac mini" : model.startsWith("iMac") ? "iMac" : model;

    return {
      model: friendlyModel, modelId: model, osVersion,
      cpuPct, cpuModel, cpuCores, cpuUser, cpuSys, cpuIdle,
      ramPct, ramUsedGb: Math.round(usedRam / 1073741824 * 10) / 10, ramTotalGb: Math.round(totalRam / 1073741824),
      diskPct, diskUsedGb: gb(diskUsedKb), diskTotalGb: gb(diskTotalKb),
      uptime, load1: load1.toFixed(2),
      ip, battStatus, battPct: parseInt(battPct) || null, charging,
      netInMb: (netIn / 1048576).toFixed(0), netOutMb: (netOut2 / 1048576).toFixed(0),
      gpus, timestamp: Date.now(),
    };
  },
};

// --- POST handlers ---
async function handlePost(pathname, body) {
  if (pathname === "/api/agent/chat") {
    const { agentId, message, model, sessionKey } = body;
    if (!message) throw new Error("message required");
    if (!agentId) throw new Error("agentId required");

    const args = ["agent", "--agent", agentId, "--message", message, "--json"];
    if (sessionKey) args.push("--session-key", sessionKey);
    // Model override is controlled by agent config — do not pass --model

    try {
      const { stdout, stderr } = await execFileAsync(OPENCLAW, args, {
        timeout: 240000,
        maxBuffer: 1024 * 1024 * 4,
      });
      // openclaw agent --json outputs a JSON object on success
      const text = stdout.trim();
      // Filter out log lines (start with "[")
      const jsonLines = text.split("\n").filter(l => !l.startsWith("[") && l.trim());
      const jsonText = jsonLines.join("\n").trim();
      if (!jsonText) {
        // No JSON output — check stderr for error message
        const errLines = (stderr || "").split("\n").filter(l => !l.startsWith("[") && l.trim());
        throw new Error(errLines.join(" ").trim() || "Agent returned no response");
      }
      try {
        return JSON.parse(jsonText);
      } catch {
        // Return plain text response if not JSON
        return { reply: jsonText, sessionKey };
      }
    } catch (e) {
      if (e.killed || e.code === "ETIMEDOUT") throw new Error("Agent timed out. The model may be loading — try again.");
      // Re-throw with cleaned message
      const msg = (e.message || "").replace(/GatewayClientRequestError: /g, "").replace(/FailoverError: /g, "");
      throw new Error(msg || "Agent error");
    }
  }

  if (pathname === "/api/agent/run") {
    const { prompt, agentId } = body;
    if (!prompt) throw new Error("prompt required");
    const args = ["agent", "--output", "json"];
    if (agentId) args.push("--agent", agentId);
    args.push(prompt);
    return oc(args);
  }

  throw new Error("Unknown route");
}

// --- Static file server ---
function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  if (pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");

    if (req.method === "POST") {
      let body = "";
      req.on("data", c => (body += c));
      req.on("end", async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const result = await handlePost(pathname, parsed);
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    const handler = API[pathname];
    if (!handler) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    try {
      const params = Object.fromEntries(url.searchParams.entries());
      const hasParams = Object.keys(params).length > 0;
      const cacheKey = hasParams ? `${pathname}?${url.searchParams}` : pathname;
      const ttl = CACHE_TTL[pathname] || CACHE_TTL.default;
      // Skip cache for parameterised requests (search queries etc)
      const data = hasParams
        ? await handler(params)
        : await cached(cacheKey, ttl, () => handler(params));
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static files
  let filePath = path.join(DIR, pathname === "/" ? "index.html" : pathname);
  // Security: stay within DIR
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  serveFile(res, filePath);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nJarvis PWA running at http://127.0.0.1:${PORT}`);
  console.log("API endpoints: /api/status /api/agents /api/tasks /api/sessions /api/models /api/cron\n");
  // Pre-warm cache in background so first browser load is fast
  const warm = ["/api/agents", "/api/status", "/api/sessions", "/api/cron", "/api/tasks", "/api/models", "/api/system"];
  warm.forEach(k => {
    const h = API[k];
    if (h) cached(k, CACHE_TTL[k] || CACHE_TTL.default, () => h({}))
      .then(() => console.log(`[cache] warmed ${k}`))
      .catch(e => console.log(`[cache] ${k} failed: ${e.message}`));
  });
});
