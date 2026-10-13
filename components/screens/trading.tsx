"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { ScreenProps } from "@/lib/nav";
import { useMarket } from "@/lib/queries";
import type { MarketResponse, MarketSeries } from "@/lib/types";

type Market = "dax" | "nasdaq";
type Side = "BUY" | "SELL";
type SignalName = "BUY" | "SELL" | "HOLD" | "NEUTRAL";
interface Signals { signal: SignalName; rsi: number | null; ma20: number | null; ma50: number | null }
interface Position { market: Market; name: string; qty: number; avgPrice: number }
interface Trade { side: Side; market: Market; name: string; qty: number; price: number; cost: number; ts: number }
interface Portfolio { balance: number; positions: Position[]; trades: Trade[] }
interface Alert { id: number; market: Market; name: string; direction: "above" | "below"; price: number; triggered: boolean }

// ── Signal math ──────────────────────────────────────────────────────────────
function calcRSI(prices: number[], period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

function calcMA(prices: number[], period: number) {
  if (prices.length < period) return null;
  const s = prices.slice(-period);
  return s.reduce((a, b) => a + b, 0) / period;
}

function getSignals(prices: number[]): Signals {
  if (!prices || prices.length < 5) return { signal: "NEUTRAL", rsi: null, ma20: null, ma50: null };
  const rsi = calcRSI(prices);
  const ma20 = calcMA(prices, Math.min(20, prices.length));
  const ma50 = calcMA(prices, Math.min(50, prices.length));
  const cur = prices[prices.length - 1];
  let bull = 0, bear = 0;
  if (rsi !== null) {
    if (rsi < 30) bull += 3; else if (rsi > 70) bear += 3;
    else if (rsi < 40) bull += 1; else if (rsi > 60) bear += 1;
  }
  if (ma20) { if (cur > ma20) bull += 1; else bear += 1; }
  if (ma50 && ma20) { if (ma20 > ma50) bull += 1; else bear += 1; }
  const signal = bull >= bear + 2 ? "BUY" : bear >= bull + 2 ? "SELL" : "HOLD";
  return { signal, rsi: rsi ? Math.round(rsi) : null, ma20, ma50 };
}

// ── Paper portfolio helpers ───────────────────────────────────────────────────
const PORTFOLIO_KEY = "ac_trading_portfolio";
const ALERTS_KEY = "ac_trading_alerts";
const INITIAL_BALANCE = 100000;

function loadPortfolio(): Portfolio {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || "null") || { balance: INITIAL_BALANCE, positions: [], trades: [] }; }
  catch { return { balance: INITIAL_BALANCE, positions: [], trades: [] }; }
}
function savePortfolio(p: Portfolio) { try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(p)); } catch {} }
function loadAlerts(): Alert[] { try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || "null") || []; } catch { return []; } }
function saveAlerts(a: Alert[]) { try { localStorage.setItem(ALERTS_KEY, JSON.stringify(a)); } catch {} }

function fmtNum(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function PriceSparkline({ prices, w = 120, h = 36, positive }: { prices: number[]; w?: number; h?: number; positive: boolean }) {
  if (!prices || prices.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...prices), mx = Math.max(...prices);
  const rng = mx - mn || 1;
  const pts = prices.map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - mn) / rng) * (h - 4) - 2}`).join(" ");
  const color = positive ? "var(--ok)" : "var(--err)";
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Signal badge ─────────────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: SignalName }) {
  const cfg: Record<SignalName, [string, string]> = { BUY: ["var(--ok)", "var(--ok-soft)"], SELL: ["var(--err)", "var(--err-soft)"], HOLD: ["var(--warn)", "var(--warn-soft)"], NEUTRAL: ["var(--text-faint)", "var(--surface)"] };
  const [color, bg] = cfg[signal] || cfg.NEUTRAL;
  return <span style={{ fontSize: 10.5, fontWeight: 720, letterSpacing: 0.5, color, background: bg, borderRadius: 6, padding: "2px 7px" }}>{signal}</span>;
}

// ── Market card ───────────────────────────────────────────────────────────────
function MarketCard({ data, sig, onTrade }: { data?: MarketSeries; sig: Signals | null; onTrade: () => void }) {
  if (!data) return (
    <div className="glass" style={{ borderRadius: 18, padding: "18px 20px", flex: 1 }}>
      <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Loading…</div>
    </div>
  );
  const up = data.changePct >= 0;
  return (
    <div className="glass tap" style={{ borderRadius: 18, padding: "16px 18px", flex: 1, cursor: "pointer" }} onClick={onTrade}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, letterSpacing: 0.3, marginBottom: 3 }}>{data.name}</div>
          <div style={{ fontSize: 22, fontWeight: 760, letterSpacing: -0.5 }}>{fmtNum(data.current, 0)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 680, color: up ? "var(--ok)" : "var(--err)" }}>
            {up ? "+" : ""}{fmtNum(data.changePct, 2)}%
          </div>
          <div style={{ fontSize: 11, color: up ? "var(--ok)" : "var(--err)", opacity: 0.8 }}>{up ? "+" : ""}{fmtNum(data.change, 0)}</div>
        </div>
      </div>
      <PriceSparkline prices={data.prices} w={130} h={32} positive={up} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <div style={{ fontSize: 10, color: "var(--text-ghost)" }}>H {fmtNum(data.high, 0)} · L {fmtNum(data.low, 0)}</div>
        {sig && <SignalBadge signal={sig.signal} />}
      </div>
    </div>
  );
}

// ── Trade modal ───────────────────────────────────────────────────────────────
function TradeModal({ market, data, portfolio, onClose, onTrade }: {
  market: Market; data?: MarketSeries; portfolio: Portfolio; onClose: () => void;
  onTrade: (side: Side, market: Market, name: string, qty: number, price: number) => void;
}) {
  const [side, setSide] = useState<Side>("BUY");
  const [qty, setQty] = useState("1");
  const price = data?.current || 0;
  const units = parseFloat(qty) || 0;
  const cost = units * price;
  const canBuy = side === "BUY" && cost > 0 && cost <= portfolio.balance;
  const pos = portfolio.positions.find(p => p.market === market);
  const canSell = side === "SELL" && pos && units > 0 && units <= pos.qty;
  const canSubmit = side === "BUY" ? canBuy : canSell;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div className="glass" style={{ width: "100%", maxWidth: 480, borderRadius: "22px 22px 0 0", padding: "24px 22px calc(24px + env(safe-area-inset-bottom, 16px))", background: "var(--surface-solid-2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 740 }}>{data?.name}</div>
          <button className="tap" style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 22, cursor: "pointer", padding: 4 }} onClick={onClose}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["BUY", "SELL"] as const).map(s => (
            <button key={s} className="tap" onClick={() => setSide(s)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
              background: side === s ? (s === "BUY" ? "var(--ok)" : "var(--err)") : "var(--surface)",
              color: side === s ? "#fff" : "var(--text-dim)" }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 6 }}>Units</div>
          <input type="number" min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)}
            style={{ width: "100%", background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 22, fontWeight: 700 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-dim)", marginBottom: 6 }}>
          <span>Price per unit</span><span>{fmtNum(price, 2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-dim)", marginBottom: 6 }}>
          <span>Total cost</span><span style={{ color: "var(--text)", fontWeight: 700 }}>${fmtNum(cost, 2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-faint)", marginBottom: 20 }}>
          <span>{side === "BUY" ? "Available balance" : "Held units"}</span>
          <span>{side === "BUY" ? "$" + fmtNum(portfolio.balance, 2) : fmtNum(pos?.qty || 0, 4)}</span>
        </div>
        <button className="tap" disabled={!canSubmit} onClick={() => onTrade(side, market, data?.name ?? market, units, price)}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", fontWeight: 740, fontSize: 15,
            background: canSubmit ? (side === "BUY" ? "var(--ok)" : "var(--err)") : "var(--surface)",
            color: canSubmit ? "#fff" : "var(--text-ghost)" }}>
          {side === "BUY" ? "Buy" : "Sell"} {units > 0 ? fmtNum(units, 2) : ""} units
        </button>
      </div>
    </div>
  );
}

// ── Alert modal ───────────────────────────────────────────────────────────────
function AlertModal({ data, market, onClose, onAdd }: {
  data?: MarketSeries; market: Market; onClose: () => void;
  onAdd: (market: Market, name: string, direction: Alert["direction"], price: number) => void;
}) {
  const [direction, setDirection] = useState<Alert["direction"]>("above");
  const [price, setPrice] = useState(data?.current ? String(Math.round(data.current * 1.01)) : "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div className="glass" style={{ width: "100%", maxWidth: 480, borderRadius: "22px 22px 0 0", padding: "24px 22px calc(24px + env(safe-area-inset-bottom, 16px))", background: "var(--surface-solid-2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 740 }}>Set Alert · {data?.name}</div>
          <button className="tap" style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: 22, cursor: "pointer", padding: 4 }} onClick={onClose}>×</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {(["above", "below"] as const).map(d => (
            <button key={d} className="tap" onClick={() => setDirection(d)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: direction === d ? "var(--accent)" : "var(--surface)", color: direction === d ? "#fff" : "var(--text-dim)" }}>
              Price goes {d}
            </button>
          ))}
        </div>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 6 }}>Target price</div>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)}
            style={{ width: "100%", background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 22, fontWeight: 700 }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 16 }}>
          Current: {fmtNum(data?.current, 2)}
        </div>
        <button className="tap" disabled={!price} onClick={() => onAdd(market, data?.name ?? market, direction, parseFloat(price))}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: price ? "pointer" : "not-allowed", fontWeight: 740, fontSize: 15,
            background: price ? "var(--accent)" : "var(--surface)", color: price ? "#fff" : "var(--text-ghost)" }}>
          Add Alert
        </button>
      </div>
    </div>
  );
}

// ── Main Trading screen ───────────────────────────────────────────────────────
export function Trading(_: ScreenProps) {
  const market = useMarket();
  const marketData: MarketResponse | undefined = market.data;
  const loading = market.isFetching;
  const error = market.error?.message ?? null;
  const [activeTab, setActiveTab] = useState<"markets" | "portfolio" | "alerts" | "history">("markets");
  const [portfolio, setPortfolio] = useState(() => loadPortfolio());
  const [alerts, setAlerts] = useState(() => loadAlerts());
  const [tradeModal, setTradeModal] = useState<Market | null>(null);
  const [alertModal, setAlertModal] = useState<Market | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMarket = () => { void market.refetch(); };

  // Check alerts whenever fresh prices arrive (only on new data, not on alert edits)
  useEffect(() => {
    const d = marketData;
    if (!d) return;
    const hits = alerts.filter(a => {
      const cur = d[a.market]?.current;
      return !a.triggered && cur != null && ((a.direction === "above" && cur >= a.price) || (a.direction === "below" && cur <= a.price));
    });
    if (!hits.length) return;
    const updated = alerts.map(a => hits.includes(a) ? { ...a, triggered: true } : a);
    setAlerts(updated);
    saveAlerts(updated);
    hits.forEach(a => showToast(`Alert: ${a.name} ${a.direction} ${fmtNum(a.price, 0)}`, true));
  }, [marketData]);

  const daxSig = marketData?.dax ? getSignals(marketData.dax.prices) : null;
  const nasdaqSig = marketData?.nasdaq ? getSignals(marketData.nasdaq.prices) : null;

  const execTrade = (side: Side, market: Market, name: string, qty: number, price: number) => {
    setPortfolio(prev => {
      const p: Portfolio = { ...prev, positions: [...prev.positions], trades: [...prev.trades] };
      const cost = qty * price;
      if (side === "BUY") {
        p.balance -= cost;
        const idx = p.positions.findIndex(x => x.market === market);
        if (idx >= 0) {
          const existing = p.positions[idx];
          const totalQty = existing.qty + qty;
          p.positions[idx] = { ...existing, qty: totalQty, avgPrice: (existing.avgPrice * existing.qty + cost) / totalQty };
        } else {
          p.positions.push({ market, name, qty, avgPrice: price });
        }
      } else {
        const idx = p.positions.findIndex(x => x.market === market);
        if (idx < 0) return prev;
        const existing = p.positions[idx];
        const proceeds = qty * price;
        p.balance += proceeds;
        const remaining = existing.qty - qty;
        if (remaining <= 0.001) p.positions.splice(idx, 1);
        else p.positions[idx] = { ...existing, qty: remaining };
      }
      p.trades.unshift({ side, market, name, qty, price, cost: qty * price, ts: Date.now() });
      if (p.trades.length > 100) p.trades = p.trades.slice(0, 100);
      savePortfolio(p);
      return p;
    });
    setTradeModal(null);
    showToast(`${side} ${fmtNum(qty, 2)} ${name} @ ${fmtNum(price, 0)}`);
  };

  const addAlert = (market: Market, name: string, direction: Alert["direction"], price: number) => {
    const newAlerts = [...alerts, { id: Date.now(), market, name, direction, price, triggered: false }];
    setAlerts(newAlerts);
    saveAlerts(newAlerts);
    setAlertModal(null);
    showToast("Alert set");
  };

  const removeAlert = (id: number) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
  };

  const resetPortfolio = () => {
    const p: Portfolio = { balance: INITIAL_BALANCE, positions: [], trades: [] };
    savePortfolio(p);
    setPortfolio(p);
    showToast("Portfolio reset to $100,000");
  };

  // Portfolio value
  const positionsWithPnl = portfolio.positions.map(pos => {
    const cur = marketData?.[pos.market]?.current;
    const value = cur != null ? pos.qty * cur : null;
    const pnl = value != null ? value - pos.qty * pos.avgPrice : null;
    const pnlPct = pnl != null ? (pnl / (pos.qty * pos.avgPrice)) * 100 : null;
    return { ...pos, current: cur, value, pnl, pnlPct };
  });
  const totalPositionValue = positionsWithPnl.reduce((s, p) => s + (p.value || 0), 0);
  const netWorth = portfolio.balance + totalPositionValue;
  const totalReturn = ((netWorth - INITIAL_BALANCE) / INITIAL_BALANCE) * 100;

  const tabStyle = (id: typeof activeTab): CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 680, fontSize: 12.5,
    background: activeTab === id ? "var(--surface-2)" : "none",
    color: activeTab === id ? "var(--text)" : "var(--text-faint)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 760, letterSpacing: -0.5 }}>Trading</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)" }}>DAX 40 · NASDAQ · Paper Mode</div>
        </div>
        <button className="tap" onClick={fetchMarket} style={{ background: "var(--surface)", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 12, color: "var(--text-dim)", cursor: "pointer", fontWeight: 680 }}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {/* Sub-nav */}
      <div style={{ padding: "0 18px 12px" }}>
        <div style={{ display: "flex", background: "var(--surface)", borderRadius: 13, padding: 3, gap: 2 }}>
          {([["markets", "Markets"], ["portfolio", "Portfolio"], ["alerts", "Alerts"], ["history", "History"]] as const).map(([id, label]) => (
            <button key={id} className="tap" style={tabStyle(id)} onClick={() => setActiveTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px", paddingBottom: "calc(100px + env(safe-area-inset-bottom, 0px))" }}>
        {/* MARKETS TAB */}
        {activeTab === "markets" && (
          <div>
            {error && <div style={{ color: "var(--err)", fontSize: 13, marginBottom: 12, padding: "10px 14px", background: "var(--err-soft)", borderRadius: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <MarketCard data={marketData?.dax} sig={daxSig} onTrade={() => setTradeModal("dax")} />
              <MarketCard data={marketData?.nasdaq} sig={nasdaqSig} onTrade={() => setTradeModal("nasdaq")} />
            </div>

            {/* Signals panel */}
            {([{ key: "dax", data: marketData?.dax, sig: daxSig }, { key: "nasdaq", data: marketData?.nasdaq, sig: nasdaqSig }] as const).map(({ key, data, sig }) => (
              <div key={key} className="glass" style={{ borderRadius: 18, padding: "16px 18px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{data?.name || key.toUpperCase()} · Signals</div>
                  {sig && <SignalBadge signal={sig.signal} />}
                </div>
                {sig ? (
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { label: "RSI (14)", value: sig.rsi != null ? sig.rsi : "—", note: sig.rsi == null ? "Neutral" : sig.rsi < 30 ? "Oversold" : sig.rsi > 70 ? "Overbought" : "Neutral",
                        color: sig.rsi == null ? "var(--text-dim)" : sig.rsi < 30 ? "var(--ok)" : sig.rsi > 70 ? "var(--err)" : "var(--text-dim)" },
                      { label: "MA 20", value: sig.ma20 ? fmtNum(sig.ma20, 0) : "—",
                        note: data && sig.ma20 && data.current > sig.ma20 ? "Above" : "Below",
                        color: data && sig.ma20 && data.current > sig.ma20 ? "var(--ok)" : "var(--err)" },
                      { label: "MA 50", value: sig.ma50 ? fmtNum(sig.ma50, 0) : "—",
                        note: data && sig.ma50 && data.current > sig.ma50 ? "Above" : sig.ma50 ? "Below" : "Need more data",
                        color: data && sig.ma50 && data.current > sig.ma50 ? "var(--ok)" : "var(--err)" },
                    ].map(({ label, value, note, color }) => (
                      <div key={label} style={{ flex: 1, background: "var(--surface)", borderRadius: 12, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-ghost)", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 760 }}>{value}</div>
                        <div style={{ fontSize: 10, color, marginTop: 2, fontWeight: 600 }}>{note}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Loading signals…</div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="tap" onClick={() => setTradeModal(key)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: "var(--ok-soft)", color: "var(--ok)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Trade</button>
                  <button className="tap" onClick={() => setAlertModal(key)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", background: "var(--surface)", color: "var(--text-dim)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Set Alert</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PORTFOLIO TAB */}
        {activeTab === "portfolio" && (
          <div>
            {/* Summary */}
            <div className="glass" style={{ borderRadius: 18, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>Net Worth</div>
              <div style={{ fontSize: 30, fontWeight: 780, letterSpacing: -1, marginBottom: 8 }}>${fmtNum(netWorth, 2)}</div>
              <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                <div><span style={{ color: "var(--text-faint)" }}>Cash </span><span style={{ fontWeight: 680 }}>${fmtNum(portfolio.balance, 2)}</span></div>
                <div><span style={{ color: "var(--text-faint)" }}>Positions </span><span style={{ fontWeight: 680 }}>${fmtNum(totalPositionValue, 2)}</span></div>
                <div><span style={{ color: totalReturn >= 0 ? "var(--ok)" : "var(--err)", fontWeight: 680 }}>{totalReturn >= 0 ? "+" : ""}{fmtNum(totalReturn, 2)}%</span></div>
              </div>
            </div>

            {/* Open positions */}
            {positionsWithPnl.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: 14 }}>
                No open positions<br /><span style={{ fontSize: 12 }}>Go to Markets to open a trade</span>
              </div>
            ) : positionsWithPnl.map(pos => (
              <div key={pos.market} className="glass" style={{ borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{pos.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>
                      {fmtNum(pos.qty, 4)} units · avg {fmtNum(pos.avgPrice, 2)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 760 }}>{pos.value != null ? "$" + fmtNum(pos.value, 2) : "—"}</div>
                    {pos.pnl != null && (
                      <div style={{ fontSize: 12, color: pos.pnl >= 0 ? "var(--ok)" : "var(--err)", fontWeight: 680 }}>
                        {pos.pnl >= 0 ? "+" : ""}${fmtNum(pos.pnl, 2)} ({(pos.pnlPct ?? 0) >= 0 ? "+" : ""}{fmtNum(pos.pnlPct, 2)}%)
                      </div>
                    )}
                  </div>
                </div>
                <button className="tap" onClick={() => setTradeModal(pos.market)} style={{ width: "100%", marginTop: 10, padding: "8px", borderRadius: 10, border: "none", background: "var(--surface)", color: "var(--text-dim)", fontSize: 12, fontWeight: 680, cursor: "pointer" }}>
                  Trade
                </button>
              </div>
            ))}

            <button className="tap" onClick={resetPortfolio} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 14, border: "1px solid var(--border)", background: "none", color: "var(--err)", fontSize: 13, fontWeight: 680, cursor: "pointer" }}>
              Reset Portfolio
            </button>
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === "alerts" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {([["dax", "DAX Alert"], ["nasdaq", "NASDAQ Alert"]] as const).map(([key, label]) => (
                <button key={key} className="tap" onClick={() => setAlertModal(key)} style={{ flex: 1, padding: "11px", borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", fontSize: 13, fontWeight: 680, cursor: "pointer" }}>
                  + {label}
                </button>
              ))}
            </div>
            {alerts.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: 14 }}>No alerts set</div>
            )}
            {alerts.map(a => (
              <div key={a.id} className="glass" style={{ borderRadius: 14, padding: "14px 16px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: a.triggered ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                    Price goes {a.direction} {fmtNum(a.price, 0)}
                  </div>
                  {a.triggered && <div style={{ fontSize: 11, color: "var(--ok)", marginTop: 3 }}>Triggered</div>}
                </div>
                <button className="tap" onClick={() => removeAlert(a.id)} style={{ background: "var(--err-soft)", border: "none", borderRadius: 10, padding: "6px 12px", color: "var(--err)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div>
            {portfolio.trades.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-faint)", fontSize: 14 }}>No trades yet</div>
            )}
            {portfolio.trades.map((t, i) => (
              <div key={i} className="glass" style={{ borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 720, padding: "2px 8px", borderRadius: 6, background: t.side === "BUY" ? "var(--ok-soft)" : "var(--err-soft)", color: t.side === "BUY" ? "var(--ok)" : "var(--err)" }}>{t.side}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>
                    {fmtNum(t.qty, 4)} units @ {fmtNum(t.price, 0)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>${fmtNum(t.cost, 2)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-ghost)" }}>{new Date(t.ts).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade modal */}
      {tradeModal && (
        <TradeModal
          market={tradeModal}
          data={marketData?.[tradeModal]}
          portfolio={portfolio}
          onClose={() => setTradeModal(null)}
          onTrade={execTrade}
        />
      )}

      {/* Alert modal */}
      {alertModal && (
        <AlertModal
          market={alertModal}
          data={marketData?.[alertModal]}
          onClose={() => setAlertModal(null)}
          onAdd={addAlert}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "calc(100px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", background: toast.ok ? "var(--ok)" : "var(--err)", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 24, zIndex: 300, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
