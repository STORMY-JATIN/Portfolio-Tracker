import React, { useState, useEffect, useRef } from "react";
import { Search, Plus, Loader2, Sparkles, PlusCircle } from "lucide-react";
import { QuoteData } from "../types";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

interface SearchLookupProps {
  onAddStock: (symbol: string, qty: number, buyPrice: number, buyDate: string, notes: string) => void;
  currency: "USD" | "INR";
  exchangeRate: number;
}

export default function SearchLookup({ onAddStock, currency, exchangeRate }: SearchLookupProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Add Holdings Form state
  const [qty, setQty] = useState<number>(10);
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [buyDate, setBuyDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [fetchingHistPrice, setFetchingHistPrice] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync historical price for selected stock and date
  useEffect(() => {
    if (!selectedStock) return;
    
    // Guard against empty, partial, or invalid date values (must be a full YYYY-MM-DD string)
    if (!buyDate || buyDate.trim().length !== 10) {
      console.warn("Skipping dynamic price sync for partial or invalid date:", buyDate);
      return;
    }
    
    // Reset buyPrice to 0 immediately on new selection/date change to avoid stale display values!
    setBuyPrice(0);
    
    let isMounted = true;
    const syncPrice = async () => {
      setFetchingHistPrice(true);
      try {
        const url = `/api/stocks/historical-price?symbol=${encodeURIComponent(selectedStock.symbol)}&date=${encodeURIComponent(buyDate)}`;
        console.log(`[Price Sync] Fetching price for ${selectedStock.symbol} on ${buyDate}...`);
        const res = await fetch(url);
        if (isMounted && res.ok) {
          const data = await res.json();
          console.log(`[Price Sync] Received data for ${selectedStock.symbol}:`, data);
          if (data && typeof data.price === "number") {
            const converted = parseFloat((data.price * exchangeRate).toFixed(2));
            setBuyPrice(converted);
            console.log(`[Price Sync] Set buy price output to: ${converted} (in active currency)`);
          }
        }
      } catch (e) {
        console.error("Failed to load historical price for buy transaction:", e);
      } finally {
        if (isMounted) {
          setFetchingHistPrice(false);
        }
      }
    };

    syncPrice();

    return () => {
      isMounted = false;
    };
  }, [selectedStock?.symbol, buyDate, exchangeRate]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search API fetch
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.quotes || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Error lookup stock ticker:", err);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch real-time price when a ticker is selected
  const handleSelectTicker = async (stock: SearchResult) => {
    setSelectedStock(stock);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    
    setQuoteLoading(true);
    try {
      const response = await fetch("/api/stocks/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: [stock.symbol] }),
      });
      if (response.ok) {
        const data = await response.json();
        const info = data[stock.symbol];
        if (info && info.success) {
          setQuoteDetails(info);
        }
      }
    } catch (err) {
      console.error("Error loaded single ticker quote:", err);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleCreateHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) return;
    
    // Convert buyPrice entered (in active currency) back to baseline USD before storing!
    const buyPriceInUSD = Number((buyPrice / exchangeRate).toFixed(4));
    
    onAddStock(
      selectedStock.symbol.toUpperCase(),
      Number(qty),
      buyPriceInUSD,
      buyDate,
      notes
    );
    
    // Reset selection state
    setSelectedStock(null);
    setQuoteDetails(null);
    setQty(10);
    setNotes("");
  };

  return (
    <div className="bg-[#141417] rounded-[24px] border border-zinc-800 p-6 relative">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-emerald-400 fill-emerald-500/20" />
        <h3 className="font-display font-semibold text-base text-white">
          Find & Add Equity Tickers
        </h3>
      </div>
      
      {/* Search Input Box */}
      <div ref={dropdownRef} className="relative z-20">
        <div className="relative">
          <input
            type="text"
            className="w-full text-xs pl-11 pr-10 py-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans transition-all text-white placeholder-zinc-500"
            placeholder="Search stocks e.g. Apple, TSLA, BTC-USD, MSFT..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
          />
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500" />
          {loading && (
            <Loader2 className="w-4 h-4 absolute right-3.5 top-3.5 text-emerald-400 animate-spin" />
          )}
        </div>

        {/* Search Suggestion Dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 shadow-2xl rounded-xl max-h-64 overflow-y-auto z-50 divide-y divide-zinc-800">
            {results.map((res) => (
              <button
                key={res.symbol}
                type="button"
                onClick={() => handleSelectTicker(res)}
                className="w-full flex items-center justify-between text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                id={`search-item-${res.symbol}`}
              >
                <div>
                  <div className="font-mono text-xs font-semibold text-white">
                    {res.symbol}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate max-w-xs sm:max-w-md">
                    {res.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono select-none px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                    {res.type}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {res.exchange}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Stock Quote Info Card & Form */}
      {selectedStock && (
        <div className="mt-5 border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 shadow-sm">
                  {selectedStock.symbol}
                </span>
                <span className="text-[10px] font-medium font-mono text-emerald-400">
                  {selectedStock.type}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-zinc-300 leading-tight mt-1.5">
                {selectedStock.name}
              </h4>
            </div>

            {/* Quick Quote Value */}
            {quoteLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                <span>Syncing price...</span>
              </div>
            ) : quoteDetails ? (
              <button
                type="button"
                onClick={() => {
                  const converted = parseFloat((quoteDetails.price * exchangeRate).toFixed(2));
                  setBuyPrice(converted);
                  console.log(`[Quick Fill] Clicked live quote to set buy price manually to: ${converted}`);
                }}
                className="text-right hover:opacity-80 active:scale-95 transition-all focus:outline-none cursor-pointer group"
                title="Click to copy live price to purchase price field"
              >
                <div className="font-mono text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                  {currency === "INR" ? "₹" : "$"}{(quoteDetails.price * exchangeRate).toFixed(2)}
                  <span className="text-[10px] text-zinc-500 font-mono font-normal ml-1">
                    {currency}
                  </span>
                </div>
                <div
                  className={`text-[10px] font-mono font-medium flex items-center justify-end gap-1 ${
                    quoteDetails.change >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {quoteDetails.change >= 0 ? "+" : ""}{currency === "INR" ? "₹" : "$"}{(quoteDetails.change * exchangeRate).toFixed(2)} (
                  {quoteDetails.changePercent >= 0 ? "+" : ""}
                  {(quoteDetails.changePercent).toFixed(2)}%)
                </div>
              </button>
            ) : (
              <div className="text-xs text-rose-400 font-medium">Quote unavailable</div>
            )}
          </div>

          {/* Form to log Quantity and Cost Price */}
          <form onSubmit={handleCreateHolding} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1 uppercase tracking-wider">
                  Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  className="w-full text-xs font-mono px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white"
                  value={qty}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1 uppercase tracking-wider flex justify-between items-center">
                  <span>Price ({currency})</span>
                  {fetchingHistPrice && (
                    <span className="text-[8px] text-emerald-400 normal-case animate-pulse font-sans">
                      Syncing...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-zinc-500 select-none">
                    {currency === "INR" ? "₹" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder={fetchingHistPrice ? "..." : "0.00"}
                    className={`w-full text-xs font-mono pl-6 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white ${
                      fetchingHistPrice ? "border-emerald-500/30 text-emerald-350 bg-zinc-950" : ""
                    }`}
                    value={buyPrice === 0 ? "" : buyPrice}
                    onChange={(e) => setBuyPrice(parseFloat(e.target.value) || 0)}
                  />
                  {fetchingHistPrice && (
                    <span className="absolute right-2.5 top-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-1 uppercase tracking-wider">
                  Purchase Date
                </label>
                <input
                  type="date"
                  className="w-full text-xs font-sans px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white scheme-dark"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1 uppercase tracking-wider">
                Custom Notes (Optional)
              </label>
              <input
                type="text"
                maxLength={80}
                className="w-full text-xs px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white"
                placeholder="e.g. Dynamic momentum buy tracker"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {qty > 0 && buyPrice > 0 && (
              <div className="flex justify-between items-center text-xs text-zinc-400 p-3 bg-[#0A0A0B] border border-zinc-800 rounded-xl font-mono">
                <span className="text-zinc-500 uppercase tracking-widest text-[9px] font-bold">Estimated Position Value</span>
                <span className="text-emerald-400 font-bold">
                  {currency === "INR" ? "₹" : "$"}{(qty * buyPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedStock(null);
                  setQuoteDetails(null);
                }}
                className="px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={qty <= 0 || buyPrice <= 0 || fetchingHistPrice}
                className="px-4.5 py-1.5 text-[11px] font-bold text-[#0A0A0B] bg-white hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {fetchingHistPrice ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Asset</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
