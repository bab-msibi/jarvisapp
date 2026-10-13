// Seeded pseudo-random walk for a consistent paper-trading simulation
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

interface SeriesSpec { name: string; baseSeed: number; startPrice: number; dailyVol: number; days?: number }

function buildSeries({ name, baseSeed, startPrice, dailyVol, days = 60 }: SeriesSpec) {
  const rand = seededRand(baseSeed);
  const now = new Date();
  let price = startPrice;
  const series: { date: string; close: number }[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
    const change = (rand() - 0.48) * dailyVol; // slight upward drift
    price = Math.max(price * (1 + change), price * 0.8);
    series.push({ date: d.toISOString().slice(0, 10), close: Math.round(price * 100) / 100 });
  }
  // Intraday movement for "today", changing once a minute
  const hourFrac = (now.getHours() + now.getMinutes() / 60) / 24;
  const todayRand = seededRand(baseSeed + Math.floor(Date.now() / 60000));
  const intradayMove = (todayRand() - 0.48) * dailyVol * 0.7 * hourFrac;
  const last = series[series.length - 1];
  const current = Math.round(last.close * (1 + intradayMove) * 100) / 100;
  const prevClose = series.length >= 2 ? series[series.length - 2].close : last.close;
  const change = current - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  return {
    name,
    current,
    prevClose,
    change: parseFloat(change.toFixed(2)),
    changePct: parseFloat(changePct.toFixed(2)),
    high: Math.round(Math.max(current, last.close) * (1 + dailyVol * 0.3) * 100) / 100,
    low: Math.round(Math.min(current, last.close) * (1 - dailyVol * 0.3) * 100) / 100,
    prices: series.map((s) => s.close),
    dates: series.map((s) => s.date),
    simulated: true,
  };
}

export function marketData() {
  return {
    dax: buildSeries({ name: "DAX 40", baseSeed: 0x44415831, startPrice: 22800, dailyVol: 0.012 }),
    nasdaq: buildSeries({ name: "NASDAQ", baseSeed: 0x4e445131, startPrice: 18900, dailyVol: 0.015 }),
    updatedAt: Date.now(),
  };
}
