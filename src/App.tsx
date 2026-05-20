import { useState, useEffect, useCallback } from "react";
import { 
  TrendingUp, 
  RotateCcw, 
  Layers, 
  HelpCircle, 
  Activity, 
  Briefcase, 
  Info,
  ChevronDown,
  Sparkles
} from "lucide-react";
import { Holding, QuoteData, HistoryPoint } from "./types";
import { DEFAULT_HOLDINGS } from "./constants";
import SearchLookup from "./components/SearchLookup";
import MetricCard from "./components/MetricCard";
import AllocationChart from "./components/AllocationChart";
import HistoryChart from "./components/HistoryChart";
import HoldingsTable from "./components/HoldingsTable";

export default function App() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  
  // Currency Toggle state persist
  const [currency, setCurrency] = useState<"USD" | "INR" >(() => {
    const saved = localStorage.getItem("portfolio_currency");
    return (saved === "INR" ? "INR" : "USD") as "USD" | "INR";
  });

  const [usdToInrRate, setUsdToInrRate] = useState<number>(() => {
    const saved = localStorage.getItem("portfolio_usd_to_inr");
    return saved ? parseFloat(saved) : 83.5;
  });

  const exchangeRate = currency === "INR" ? usdToInrRate : 1;

  const handleToggleCurrency = (newCurrency: "USD" | "INR") => {
    setCurrency(newCurrency);
    localStorage.setItem("portfolio_currency", newCurrency);
  };

  const formatMoneyWithDecimals = (val: number, minDec: number = 2, maxDec: number = 2) => {
    const converted = val * exchangeRate;
    const locale = currency === "INR" ? "en-IN" : "en-US";
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${converted.toLocaleString(locale, { minimumFractionDigits: minDec, maximumFractionDigits: maxDec })}`;
  };

  // Initialize holdings from localstorage or seed defaults
  useEffect(() => {
    const saved = localStorage.getItem("portfolio_holdings");
    if (saved) {
      try {
        setHoldings(JSON.parse(saved));
      } catch {
        setHoldings(DEFAULT_HOLDINGS);
      }
    } else {
      setHoldings(DEFAULT_HOLDINGS);
      localStorage.setItem("portfolio_holdings", JSON.stringify(DEFAULT_HOLDINGS));
    }
  }, []);

  // Sync quotes and timeline aggregate when files are verified
  const fetchQuotesAndHistory = useCallback(async (currentHoldings: Holding[]) => {
    if (currentHoldings.length === 0) {
      setQuotes({});
      setHistory([]);
      return;
    }

    setRefreshing(true);
    // Only set loadingHistory on first load or manual adjustments to prevent visual flickers
    setLoadingHistory(prev => prev || history.length === 0);
    
    // Fetch live Forex Exchange Rate (USD to INR) dynamically
    try {
      const fxRes = await fetch("/api/forex/rate");
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        if (fxData && typeof fxData.rate === "number") {
          setUsdToInrRate(fxData.rate);
          localStorage.setItem("portfolio_usd_to_inr", fxData.rate.toString());
        }
      }
    } catch (err) {
      console.error("Failed to load real-time USDINR exchange rate:", err);
    }

    const uniqueSymbols = Array.from(
      new Set(currentHoldings.map((h) => h.symbol.toUpperCase()))
    );

    try {
      // 1. Fetch Real-Time Quotes
      const response = await fetch("/api/stocks/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: uniqueSymbols }),
      });
      if (response.ok) {
        const quoteData = await response.json();
        setQuotes(quoteData);
      }
    } catch (err) {
      console.error("Failed to load real-time quotes:", err);
    } finally {
      setRefreshing(false);
    }

    try {
      // 2. Refresh Historical Performance Timeline
      const response = await fetch("/api/stocks/portfolio-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: currentHoldings }),
      });
      if (response.ok) {
        const historyData = await response.json();
        setHistory(historyData);
      }
    } catch (err) {
      console.error("Failed to load portfolio history timeline:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [history.length, setUsdToInrRate]);

  // Load backend sync once holdings load
  useEffect(() => {
    if (holdings.length > 0) {
      fetchQuotesAndHistory(holdings);
    }
  }, [holdings, fetchQuotesAndHistory]);

  // Periodic price polling every 120 seconds
  useEffect(() => {
    if (holdings.length === 0) return;
    const interval = setInterval(() => {
      fetchQuotesAndHistory(holdings);
    }, 120000);
    return () => clearInterval(interval);
  }, [holdings, fetchQuotesAndHistory]);

  // Trigger manual sync
  const handleManualSync = () => {
    fetchQuotesAndHistory(holdings);
  };

  // Add stock holding
  const handleAddStock = (
    symbol: string,
    qty: number,
    buyPrice: number,
    buyDate: string,
    notes: string
  ) => {
    // Check if symbol already logged - if so, aggregate it with weighted average cost basis or add separate position
    // For simplicity, we merge positions of identical symbols
    const uppercaseSymbol = symbol.toUpperCase().trim();
    const existingIndex = holdings.findIndex(
      (h) => h.symbol.toUpperCase() === uppercaseSymbol
    );
    
    let updated: Holding[];
    if (existingIndex !== -1) {
      updated = [...holdings];
      const existing = updated[existingIndex];
      const totalCost = existing.qty * existing.buyPrice + qty * buyPrice;
      const totalQty = existing.qty + qty;
      updated[existingIndex] = {
        ...existing,
        qty: parseFloat(totalQty.toFixed(4)),
        buyPrice: parseFloat((totalCost / totalQty).toFixed(4)),
        notes: notes ? notes : existing.notes,
      };
    } else {
      const newHolding: Holding = {
        id: Date.now().toString(),
        symbol: uppercaseSymbol,
        qty,
        buyPrice,
        buyDate,
        notes,
      };
      updated = [...holdings, newHolding];
    }

    setHoldings(updated);
    localStorage.setItem("portfolio_holdings", JSON.stringify(updated));
  };

  // Modify quantities or buyPrice values
  const handleUpdateHolding = (id: string, qty: number, buyPrice: number, notes: string) => {
    const updated = holdings.map((h) => {
      if (h.id === id) {
        return { ...h, qty, buyPrice, notes };
      }
      return h;
    });
    setHoldings(updated);
    localStorage.setItem("portfolio_holdings", JSON.stringify(updated));
  };

  // Delete/Liquidate stock holding
  const handleDeleteHolding = (id: string) => {
    const updated = holdings.filter((h) => h.id !== id);
    setHoldings(updated);
    localStorage.setItem("portfolio_holdings", JSON.stringify(updated));
  };

  // Reset standard seed holdings
  const handleResetToDefault = () => {
    if (window.confirm("Verify: Reset portfolio back to standard sample entries?")) {
      setHoldings(DEFAULT_HOLDINGS);
      localStorage.setItem("portfolio_holdings", JSON.stringify(DEFAULT_HOLDINGS));
    }
  };

  // Portfolio Totals metrics compiles
  const totalCost = holdings.reduce((sum, h) => sum + h.buyPrice * h.qty, 0);

  const totalValue = holdings.reduce((sum, h) => {
    const q = quotes[h.symbol];
    const currentPrice = q && q.success ? q.price : h.buyPrice;
    return sum + currentPrice * h.qty;
  }, 0);

  const totalGainLoss = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Day's return represents the aggregate shift across today's sessions
  const totalDayGainLoss = holdings.reduce((sum, h) => {
    const q = quotes[h.symbol];
    if (q && q.success) {
      return sum + q.change * h.qty;
    }
    return sum;
  }, 0);

  const previousDayValue = totalValue - totalDayGainLoss;
  const totalDayGainPercent = previousDayValue > 0 ? (totalDayGainLoss / previousDayValue) * 100 : 0;  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-350 antialiased font-sans pb-16">
      {/* Premium top branding strip */}
      <header className="sticky top-0 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-zinc-800/60 z-40">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500 rounded-xl text-black shadow-md shadow-emerald-500/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-lg text-white tracking-tight leading-none">
                  QUANT_TRAC
                </h1>
                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-850 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 inline-block animate-pulse" />
                  API LIVE
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-1 inline-block">
                Yahoo Finance Server Stream
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Exchange Rate Companion */}
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-400 font-mono shadow-sm">
              <span className="text-zinc-500">USD/INR:</span>
              <span className="font-bold text-emerald-400">₹{usdToInrRate.toFixed(2)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-450 inline-block animate-pulse" />
            </div>

            {/* Currency Selector Toggle Toggle */}
            <div className="flex bg-zinc-905 border border-zinc-800 rounded-lg p-0.5" id="currency-toggle">
              <button
                type="button"
                onClick={() => handleToggleCurrency("USD")}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                  currency === "USD" 
                    ? "bg-zinc-800 text-emerald-400" 
                    : "text-zinc-550 hover:text-zinc-300"
                }`}
                title="View portfolio in USD"
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => handleToggleCurrency("INR")}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-md transition-all cursor-pointer ${
                  currency === "INR" 
                    ? "bg-zinc-800 text-emerald-400" 
                    : "text-zinc-550 hover:text-zinc-300"
                }`}
                title="View portfolio in Indian Rupees (₹)"
              >
                INR (₹)
              </button>
            </div>

            <button
              onClick={() => setShowFaq(!showFaq)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-750 rounded-lg transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>How it works</span>
            </button>

            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-300 bg-zinc-900 hover:bg-zinc-850 border border-dashed border-zinc-800 rounded-lg transition-all cursor-pointer"
              title="Reset sample stocks"
            >
              <RotateCcw className="w-3 h-3 text-zinc-500" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
        
        {/* Quick FAQ info banner */}
        {showFaq && (
          <div className="bg-[#141417] text-zinc-303 rounded-[24px] p-6 border border-zinc-800 shadow-2xl relative animate-fade-in">
            <h3 className="font-display font-semibold text-sm text-white mb-2 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-400" /> Understanding Data Fetching
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-850/60">
              <div>
                <h4 className="font-bold text-white mb-1 uppercase tracking-wider text-[10px] text-emerald-400 font-mono">Real-time Rates</h4>
                <p className="leading-relaxed">Stock prices and trading sessions are matched to actual ticker streams via the server Yahoo Finance API, preventing delayed evaluations.</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-1 uppercase tracking-wider text-[10px] text-emerald-400 font-mono">Dynamic Portfolio Timeline</h4>
                <p className="leading-relaxed">Entering purchase parameters builds an compiled 30-day aggregate timeline, representing historical cash valuations.</p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-1 uppercase tracking-wider text-[10px] text-emerald-400 font-mono">Weighted Cost Basis</h4>
                <p className="leading-relaxed">Adding separate blocks of identical equity tickers will automatically merge transactions under a weighted cost basis.</p>
              </div>
            </div>

            {/* Yahoo Finance Ticker Reference Section */}
            <div className="mt-6 border-t border-zinc-850/60 pt-5">
              <h4 className="font-display font-semibold text-xs text-white mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 fill-emerald-500/10" />
                YAHOO FINANCE TICKER REFERENCE INDEX
              </h4>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                Since all asset evaluations are fetched live from Yahoo Finance API, format ticker symbols according to standard query rules:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-[11px] font-mono">
                <div className="bg-[#0A0A0B] border border-zinc-850/60 p-3 rounded-xl">
                  <div className="text-white font-bold text-xs font-sans">US Equities</div>
                  <div className="text-zinc-500 text-[9px] mt-0.5">No suffix required</div>
                  <div className="text-emerald-400 mt-2 font-semibold">AAPL, MSFT, TSLA, NVDA</div>
                </div>
                <div className="bg-[#0A0A0B] border border-zinc-850/60 p-3 rounded-xl">
                  <div className="text-white font-bold text-xs font-sans">Indian Equities</div>
                  <div className="text-zinc-500 text-[9px] mt-0.5">NSE: suffix <span className="text-white">.NS</span></div>
                  <div className="text-emerald-450 mt-2 font-semibold">RELIANCE.NS, TCS.NS</div>
                </div>
                <div className="bg-[#0A0A0B] border border-zinc-850/60 p-3 rounded-xl">
                  <div className="text-white font-bold text-xs font-sans">Global Crypto</div>
                  <div className="text-zinc-500 text-[9px] mt-0.5">Use <span className="text-white">-USD</span> pair</div>
                  <div className="text-emerald-400 mt-2 font-semibold">BTC-USD, ETH-USD</div>
                </div>
                <div className="bg-[#0A0A0B] border border-zinc-850/60 p-3 rounded-xl">
                  <div className="text-white font-bold text-xs font-sans">Indices & Forex</div>
                  <div className="text-zinc-500 text-[9px] mt-0.5">Use query index prefixes</div>
                  <div className="text-emerald-450 mt-2 font-semibold">^NSEI (Nifty), GC=F (Gold)</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowFaq(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors p-1 cursor-pointer animate-pulse"
            >
              <ChevronDown className="w-4 h-4 rotate-180" />
            </button>
          </div>
        )}

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Equity Net Worth"
            value={formatMoneyWithDecimals(totalValue, 2, 2)}
            subValue={`Costbasis: ${formatMoneyWithDecimals(totalCost, 0, 0)}`}
            type="currency"
          />
          <MetricCard
            label="Daily Session Return"
            value={`${totalDayGainLoss >= 0 ? "+" : ""}${formatMoneyWithDecimals(totalDayGainLoss, 2, 2)}`}
            subValue={`${totalDayGainPercent >= 0 ? "+" : ""}${totalDayGainPercent.toFixed(2)}%`}
            isPositive={totalDayGainLoss >= 0}
            type="day"
          />
          <MetricCard
            label="Total Returns (U.G/L)"
            value={`${totalGainLoss >= 0 ? "+" : ""}${formatMoneyWithDecimals(totalGainLoss, 2, 2)}`}
            subValue={`${totalGainPercent >= 0 ? "+" : ""}${totalGainPercent.toFixed(2)}%`}
            isPositive={totalGainLoss >= 0}
            type="gain"
          />
          <MetricCard
            label="Assets Tracked"
            value={`${holdings.length} Positions`}
            subValue={`Current display in ${currency}`}
            type="invested"
          />
        </div>

        {/* Bento Grid Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column Left: Actions and Weight Distributions */}
          <div className="col-span-1 space-y-6">
            <SearchLookup onAddStock={handleAddStock} currency={currency} exchangeRate={exchangeRate} />
            <AllocationChart holdings={holdings} quotes={quotes} currency={currency} exchangeRate={exchangeRate} />
          </div>

          {/* Column Right: Aggregated 30-Day Value Line */}
          <div className="lg:col-span-2">
            <HistoryChart history={history} loading={loadingHistory} currency={currency} exchangeRate={exchangeRate} />
          </div>
        </div>

        {/* Ledger catalog / Operations layout */}
        <div className="pt-2">
          <HoldingsTable
            holdings={holdings}
            quotes={quotes}
            onDeleteHolding={handleDeleteHolding}
            onUpdateHolding={handleUpdateHolding}
            refreshing={refreshing}
            onTriggerRefresh={handleManualSync}
            currency={currency}
            exchangeRate={exchangeRate}
          />
        </div>
      </main>

      {/* Decorative tiny footer */}
      <footer className="mt-16 text-center text-xs text-zinc-650 border-t border-zinc-900 pt-8 w-full max-w-7xl mx-auto px-4">
        <p className="font-sans">
          QUANT_TRAC is powered by Node.js & Yahoo Finance APIs. Portfolio sessions use client-side localized persistence safely.
        </p>
      </footer>
    </div>
  );
}
