export interface Holding {
  id: string;
  symbol: string;
  qty: number;
  buyPrice: number;
  buyDate?: string;
  notes?: string;
}

export interface QuoteData {
  symbol: string;
  success: boolean;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string;
  longName: string;
  high?: number | null;
  low?: number | null;
  open?: number | null;
  error?: string;
}

export interface HistoryPoint {
  date: string;
  value: number;
  cost: number;
  gainLoss: number;
  gainLossPercent: number;
}
