import { execFile } from "node:child_process";
import os from "node:os";

const run = (cmd: string, args: string[]) =>
  new Promise<string>((res, rej) => {
    execFile(cmd, args, { timeout: 5000, maxBuffer: 1024 * 256 }, (err, out) => (err ? rej(err) : res(out.trim())));
  });

// Busiest GPU's "Device Utilization %" from the IOAccelerator registry (Intel + AMD on this Mac)
export async function gpuPct() {
  const out = await run("ioreg", ["-r", "-d", "1", "-c", "IOAccelerator"]).catch(() => "");
  const vals = [...out.matchAll(/"Device Utilization %"=(\d+)/g)].map((m) => parseInt(m[1]));
  return vals.length ? Math.max(...vals) : null;
}

// RAM in use, the same way Activity Monitor counts it: everything but free + speculative pages
export function ramUsedFrom(vmStat: string) {
  const pageSize = parseInt((vmStat.match(/page size of (\d+) bytes/) || [])[1] ?? "") || 4096;
  const vmNum = (key: string) => {
    const m = vmStat.match(new RegExp(key + ":\\s+(\\d+)"));
    return m ? parseInt(m[1]) * pageSize : 0;
  };
  return os.totalmem() - (vmNum("Pages free") + vmNum("Pages speculative"));
}

export const vmStat = () => run("vm_stat", []);

// Static hardware facts; system_profiler alone takes ~1s, so only ask once
let hardware: Promise<{ cpuModel: string; gpus: string[] }> | null = null;
const hardwareInfo = () => (hardware ??= (async () => {
  const cpuModel = await run("sysctl", ["-n", "machdep.cpu.brand_string"]).catch(() => "Unknown CPU");
  const gpuInfo = await run("bash", ["-c", "system_profiler SPDisplaysDataType 2>/dev/null | grep -E 'Chipset Model|VRAM' | head -4"]).catch(() => "");
  const gpus = gpuInfo.split("\n").filter((l) => l.includes("Chipset")).map((l) => l.replace(/.*Chipset Model:\s*/, "").trim());
  return { cpuModel, gpus };
})());

export async function systemStats() {
  const [cpuLine, vmOut, dfOut, swVers, battOut, modelStr, loadStr, netOut, gpu, { cpuModel, gpus }] = await Promise.all([
    run("bash", ["-c", "top -l 1 -n 0 | grep 'CPU usage'"]),
    vmStat(),
    run("df", ["-k", "/"]),
    run("sw_vers", []),
    run("pmset", ["-g", "batt"]),
    run("sysctl", ["-n", "hw.model"]),
    run("sysctl", ["-n", "vm.loadavg"]),
    run("netstat", ["-ib"]).catch(() => ""),
    gpuPct(),
    hardwareInfo(),
  ]);

  const cpuM = cpuLine.match(/([\d.]+)% user.*?([\d.]+)% sys.*?([\d.]+)% idle/);
  const cpuUser = cpuM ? parseFloat(cpuM[1]) : 0;
  const cpuSys = cpuM ? parseFloat(cpuM[2]) : 0;
  const cpuIdle = cpuM ? parseFloat(cpuM[3]) : 100;

  const totalRam = os.totalmem();
  const usedRam = ramUsedFrom(vmOut);

  const dfParts = (dfOut.split("\n")[1] || "").trim().split(/\s+/);
  const diskTotalKb = parseInt(dfParts[1]) || 0;
  // "/" is the sealed system volume (~12 GB); every APFS volume shares the container's space,
  // so used = container size − free, which is what Finder reports
  const diskUsedKb = Math.max(diskTotalKb - (parseInt(dfParts[3]) || 0), 0);
  // Decimal GB, like Finder
  const gb = (kb: number) => ((kb * 1024) / 1e9).toFixed(0);

  const uptimeSec = Math.floor(os.uptime());
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const mins = Math.floor((uptimeSec % 3600) / 60);

  const battLine = battOut.split("\n").find((l) => l.includes("InternalBattery")) || "";
  const battPct = (battLine.match(/(\d+)%/) || [])[1];
  const battStatus = battLine.includes("charged") ? "AC Power · Charged"
    : battLine.includes("charging") ? `AC Power · Charging ${battPct}%`
    : battPct ? `${battPct}% · On Battery` : "AC Power";

  const load1 = parseFloat((loadStr.match(/[\d.]+/g) || [])[0] ?? "") || 0;

  const ip = (() => {
    const ifaces = os.networkInterfaces();
    for (const name of ["en0", "en1", "eth0"]) {
      const i = ifaces[name]?.find((a) => a.family === "IPv4" && !a.internal);
      if (i) return i.address;
    }
    return "–";
  })();

  const netParts = (netOut.split("\n").find((l) => /^en0\s/.test(l) && l.includes(".")) || "").trim().split(/\s+/);
  const netIn = parseInt(netParts[6]) || 0;
  const netOutBytes = parseInt(netParts[9]) || 0;

  const model = modelStr.trim();
  const friendlyModel = model.startsWith("MacBookPro") ? "MacBook Pro" : model.startsWith("MacBookAir") ? "MacBook Air"
    : model.startsWith("MacPro") ? "Mac Pro" : model.startsWith("MacStudio") ? "Mac Studio"
    : model.startsWith("Macmini") ? "Mac mini" : model.startsWith("iMac") ? "iMac" : model;

  return {
    model: friendlyModel, modelId: model,
    osVersion: (swVers.match(/ProductVersion:\s+(.+)/) || [])[1] || "macOS",
    cpuPct: Math.round(cpuUser + cpuSys), cpuModel, cpuCores: os.cpus().length, cpuUser, cpuSys, cpuIdle,
    ramPct: Math.round((usedRam / totalRam) * 100),
    ramUsedGb: Math.round((usedRam / 1073741824) * 10) / 10,
    ramTotalGb: Math.round(totalRam / 1073741824),
    diskPct: diskTotalKb ? Math.round((diskUsedKb / diskTotalKb) * 100) : 0,
    diskUsedGb: gb(diskUsedKb), diskTotalGb: gb(diskTotalKb),
    uptime: days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`,
    load1: load1.toFixed(2),
    ip, battStatus, battPct: parseInt(battPct ?? "") || null,
    charging: battLine.includes("charging") || battLine.includes("charged"),
    netInMb: (netIn / 1048576).toFixed(0), netOutMb: (netOutBytes / 1048576).toFixed(0),
    gpuPct: gpu, gpus, timestamp: Date.now(),
  };
}
