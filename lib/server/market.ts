// Real index prices from Yahoo Finance's public chart API (no key; unofficial, so failures are
// reported rather than papered over). One minute cache; on errors the last good data is served as stale.
import { cached } from "./cache";
import { HttpError } from "./http";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Jarvis";
const INDICES = {
  dax: { symbol: "^GDAXI", name: "DAX 40" },
  nasdaq: { symbol: "^IXIC", name: "NASDAQ Composite" },
} as const;

interface ChartMeta {
  symbol: string; currency?: string; exchangeTimezoneName?: string;
  regularMarketPrice?: number; regularMarketTime?: number; chartPreviousClose?: number; previousClose?: number;
  regularMarketDayHigh?: number; regularMarketDayLow?: number;
  currentTradingPeriod?: { regular?: { start: number; end: number } };
}
interface ChartResult { meta: ChartMeta; timestamp?: number[]; indicators: { quote: { close: (number | null)[] }[] } }

async function chart(symbol: string, range: string, interval: string): Promise<ChartResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo Finance answered HTTP ${res.status} for ${symbol}`);
  const body = (await res.json()) as { chart?: { result?: ChartResult[]; error?: { description?: string } } };
  const result = body.chart?.result?.[0];
  if (!result) throw new Error(body.chart?.error?.description || `No data for ${symbol}`);
  return result;
}

const round = (n: number) => Math.round(n * 100) / 100;

async function series(key: keyof typeof INDICES) {
  const { symbol, name } = INDICES[key];
  // Six months of daily closes (enough for the 50-day average) + today's session for prev close / high / low
  const [daily, today] = await Promise.all([chart(symbol, "6mo", "1d"), chart(symbol, "1d", "5m")]);
  const ts = daily.timestamp ?? [];
  const closes = daily.indicators.quote[0]?.close ?? [];
  const points = ts.map((t, i) => ({ t, c: closes[i] })).filter((p): p is { t: number; c: number } => p.c != null);
  const m = today.meta;
  const current = m.regularMarketPrice ?? points.at(-1)?.c;
  const prevClose = m.chartPreviousClose ?? m.previousClose ?? points.at(-2)?.c;
  if (current == null || prevClose == null) throw new Error(`Incomplete data for ${symbol}`);
  // The daily series ends with today's still-moving bar; pin it to the live price
  if (points.length && m.regularMarketTime && points.at(-1)!.t >= (m.currentTradingPeriod?.regular?.start ?? Infinity)) points.at(-1)!.c = current;
  const period = m.currentTradingPeriod?.regular;
  const nowSec = Date.now() / 1000;
  const change = current - prevClose;
  return {
    name, symbol, currency: m.currency ?? "",
    current: round(current), prevClose: round(prevClose),
    change: round(change), changePct: round((change / prevClose) * 100),
    high: round(m.regularMarketDayHigh ?? current), low: round(m.regularMarketDayLow ?? current),
    prices: points.map((p) => round(p.c)),
    dates: points.map((p) => new Date(p.t * 1000).toISOString().slice(0, 10)),
    open: !!period && nowSec >= period.start && nowSec < period.end,
    asOf: (m.regularMarketTime ?? nowSec) * 1000,
    timezone: m.exchangeTimezoneName ?? "",
  };
}

type Series = Awaited<ReturnType<typeof series>>;
type Market = { dax: Series; nasdaq: Series; updatedAt: number; source: string; stale: boolean; error: string | null };

const g = globalThis as typeof globalThis & { __lastMarket?: Market };

async function load(): Promise<Market> {
  try {
    const [dax, nasdaq] = await Promise.all([series("dax"), series("nasdaq")]);
    return (g.__lastMarket = { dax, nasdaq, updatedAt: Date.now(), source: "Yahoo Finance", stale: false, error: null });
  } catch (e) {
    const last = g.__lastMarket;
    if (last) return { ...last, stale: true, error: (e as Error).message };
    throw new HttpError(502, `Market data unavailable: ${(e as Error).message}`);
  }
}

export const marketData = () => cached("market", 60000, load);
