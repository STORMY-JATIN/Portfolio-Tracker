import { Holding } from "./types";

export const DEFAULT_HOLDINGS: Holding[] = [
  { id: "1", symbol: "AAPL", qty: 15, buyPrice: 172.50, buyDate: "2025-11-20", notes: "Core tech holding" },
  { id: "2", symbol: "MSFT", qty: 8, buyPrice: 395.00, buyDate: "2025-12-15", notes: "Cloud and AI leader" },
  { id: "3", symbol: "NVDA", qty: 20, buyPrice: 110.00, buyDate: "2026-02-05", notes: "AI chips GPU leader" },
  { id: "4", symbol: "TSLA", qty: 12, buyPrice: 175.40, buyDate: "2026-01-10", notes: "EV and robotics play" },
];
