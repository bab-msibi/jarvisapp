// Paper-trading portfolio, kept in this browser's localStorage and valued against /api/market
import type { MarketResponse } from "@/lib/types";

export type Market = "dax" | "nasdaq";
export type Side = "BUY" | "SELL";
export interface Position { market: Market; name: string; qty: number; avgPrice: number }
export interface Trade { side: Side; market: Market; name: string; qty: number; price: number; cost: number; ts: number }
export interface Portfolio { balance: number; positions: Position[]; trades: Trade[] }

const PORTFOLIO_KEY = "ac_trading_portfolio";
export const INITIAL_BALANCE = 100000;

export function loadPortfolio(): Portfolio {
  try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || "null") || { balance: INITIAL_BALANCE, positions: [], trades: [] }; }
  catch { return { balance: INITIAL_BALANCE, positions: [], trades: [] }; }
}
export function savePortfolio(p: Portfolio) { try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(p)); } catch {} }

export function valuePortfolio(portfolio: Portfolio, market?: MarketResponse) {
  const positions = portfolio.positions.map(pos => {
    const current = market?.[pos.market]?.current;
    const value = current != null ? pos.qty * current : null;
    const pnl = value != null ? value - pos.qty * pos.avgPrice : null;
    const pnlPct = pnl != null ? (pnl / (pos.qty * pos.avgPrice)) * 100 : null;
    return { ...pos, current, value, pnl, pnlPct };
  });
  const positionValue = positions.reduce((s, p) => s + (p.value || 0), 0);
  const netWorth = portfolio.balance + positionValue;
  return { positions, positionValue, netWorth, totalReturn: ((netWorth - INITIAL_BALANCE) / INITIAL_BALANCE) * 100 };
}
