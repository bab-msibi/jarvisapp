// Plain-English cron schedules: "30 7 * * *" → "Daily at 07:30"
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: string) => n.padStart(2, "0");

export function cronText(expr?: string) {
  if (!expr) return "No schedule";
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = f;
  const num = /^\d+$/;
  const at = num.test(min) && num.test(hour) ? `${pad(hour)}:${pad(min)}` : null;
  if (/^\*\/\d+$/.test(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return `Every ${min.slice(2)} minutes`;
  if (num.test(min) && /^\*\/\d+$/.test(hour) && dom === "*" && mon === "*" && dow === "*") return `Every ${hour.slice(2)} hours`;
  if (num.test(min) && hour === "*" && dom === "*" && mon === "*" && dow === "*") return `Hourly at :${pad(min)}`;
  if (at && dom === "*" && mon === "*") {
    if (dow === "*") return `Daily at ${at}`;
    if (dow === "1-5") return `Weekdays at ${at}`;
    if (dow === "0,6" || dow === "6,0") return `Weekends at ${at}`;
    if (/^[0-7](,[0-7])*$/.test(dow)) return `${dow.split(",").map((d) => DAYS[+d % 7]).join(", ")} at ${at}`;
  }
  if (at && num.test(dom) && mon === "*" && dow === "*") return `Monthly on day ${dom} at ${at}`;
  return expr;
}

// "today 07:30", "tomorrow 07:30", "Thu 07:30", "17 Oct 07:30"
export function whenText(ms?: number) {
  if (!ms) return "–";
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const diff = Math.floor((new Date(d).setHours(0, 0, 0, 0) - day0.getTime()) / 86400000);
  if (diff === 0) return `today ${time}`;
  if (diff === 1) return `tomorrow ${time}`;
  if (diff === -1) return `yesterday ${time}`;
  if (diff > 1 && diff < 7) return `${DAYS[d.getDay()]} ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}
