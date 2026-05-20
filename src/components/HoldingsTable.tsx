import { useState } from "react";
import { Trash2, Edit2, Check, X, RefreshCw, Eye, EyeOff, Search, ChevronRight, AlertCircle, Info } from "lucide-react";
import { Holding, QuoteData } from "../types";

interface HoldingsTableProps {
  holdings: Holding[];
  quotes: Record<string, QuoteData>;
  onDeleteHolding: (id: string) => void;
  onUpdateHolding: (id: string, qty: number, buyPrice: number, notes: string) => void;
  refreshing: boolean;
  onTriggerRefresh: () => void;
  currency: "USD" | "INR";
  exchangeRate: number;
}

export default function HoldingsTable({
  holdings,
  quotes,
  onDeleteHolding,
  onUpdateHolding,
  refreshing,
  onTriggerRefresh,
  currency,
  exchangeRate,
}: HoldingsTableProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Edit form state
  const [editQty, setEditQty] = useState(0);
  const [editBuyPrice, setEditBuyPrice] = useState(0);
  const [editNotes, setEditNotes] = useState("");

  // Track expanded row for details view (mobile/desktop extra info toggle)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const startEdit = (h: Holding) => {
    setEditingId(h.id);
    setEditQty(h.qty);
    setEditBuyPrice(parseFloat((h.buyPrice * exchangeRate).toFixed(2))); // Display in active currency!
    setEditNotes(h.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    // Convert edited price back to USD baseline before saving!
    const buyPriceInUSD = Number((editBuyPrice / exchangeRate).toFixed(4));
    onUpdateHolding(id, editQty, buyPriceInUSD, editNotes);
    setEditingId(null);
  };

  const filteredHoldings = holdings.filter((h) => {
    const symbolMatch = h.symbol.toLowerCase().includes(filterQuery.toLowerCase());
    const quote = quotes[h.symbol];
    const nameMatch = quote?.longName?.toLowerCase().includes(filterQuery.toLowerCase()) ?? false;
    const notesMatch = h.notes?.toLowerCase().includes(filterQuery.toLowerCase()) ?? false;
    return symbolMatch || nameMatch || notesMatch;
  });

  return (
    <div className="bg-[#141417] rounded-[24px] border border-zinc-800 overflow-hidden flex flex-col">
      {/* Header controls strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-zinc-800">
        <div>
          <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
            Holdings Ledger
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
              {holdings.length}
            </span>
          </h3>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">
            Adjust sizes and manage purchase points
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Filter Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by symbol/notes..."
              className="text-xs pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-48 text-white placeholder-zinc-500"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          </div>

          {/* Core Refresh Trigger */}
          <button
            onClick={onTriggerRefresh}
            disabled={refreshing}
            className="p-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 hover:border-zinc-600 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center cursor-pointer"
            title="Refresh Quotes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {filteredHoldings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <AlertCircle className="w-10 h-10 text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-400 font-semibold animate-pulse">No assets found matching parameters</p>
          <p className="text-xs text-zinc-500 mt-1">Try searching and logging another ticker symbol above</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-[#1a1a1e]/40 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/20">
                <th className="py-4 px-6">Symbol / Company</th>
                <th className="py-4 px-4 text-right">Quantity</th>
                <th className="py-4 px-4 text-right">Buy Price</th>
                <th className="py-4 px-4 text-right">Cost Basis</th>
                <th className="py-4 px-4 text-right">Current Price</th>
                <th className="py-4 px-4 text-right">Market Value</th>
                <th className="py-4 px-4 text-right">Total Gain/Loss</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-xs">
              {filteredHoldings.map((h) => {
                const q = quotes[h.symbol];
                const currentPrice = q && q.success ? q.price : null;
                const changeP = q?.changePercent ?? null;
                const companyName = q?.longName || "Retrieving info...";
                const isPriceUp = changeP !== null ? changeP >= 0 : null;

                const costBasisVal = h.qty * h.buyPrice;
                const marketVal = currentPrice !== null ? h.qty * currentPrice : costBasisVal;
                const unrealizedGL = marketVal - costBasisVal;
                const unrealizedGLPercent = costBasisVal > 0 ? (unrealizedGL / costBasisVal) * 100 : 0;
                
                const isRowBeingEdited = editingId === h.id;
                const isRowExpanded = expandedId === h.id;

                return (
                  <tr
                    key={h.id}
                    className={`hover:bg-zinc-800/15 transition-colors group ${
                      isRowBeingEdited ? "bg-zinc-850/40" : ""
                    }`}
                  >
                    {/* Symbol / Company */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExpandedId(isRowExpanded ? null : h.id)}
                          className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer border border-zinc-750"
                          title="View Technical Stats"
                        >
                          <ChevronRight className={`w-3 h-3 transition-transform ${isRowExpanded ? "rotate-90 text-emerald-400" : ""}`} />
                        </button>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white uppercase tracking-tight text-sm">
                              {h.symbol}
                            </span>
                            {h.notes && (
                              <span className="text-[9px] font-sans px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 max-w-[120px] truncate" title={h.notes}>
                                {h.notes}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[160px] sm:max-w-[200px]" title={companyName}>
                            {companyName}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Technical Stats Drawer */}
                      {isRowExpanded && (
                        <div className="mt-3.5 bg-zinc-950 text-zinc-400 rounded-xl p-4 font-mono text-[10px] grid grid-cols-2 gap-y-2 gap-x-4 border border-zinc-800 shadow-inner relative z-10">
                          <div className="col-span-2 text-emerald-400 font-bold border-b border-zinc-800 pb-1.5 flex items-center gap-1 uppercase tracking-wider text-[9px]">
                            <Info className="w-3.5 h-3.5" />
                            TECHNICAL QUOTE ANALYSIS
                          </div>
                          <div>
                            <span className="text-zinc-500">Day High:</span>{" "}
                            <span className="text-white font-semibold">
                              {q?.high ? `${currency === "INR" ? "₹" : "$"}${(q.high * exchangeRate).toFixed(2)}` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Day Low:</span>{" "}
                            <span className="text-white font-semibold">
                              {q?.low ? `${currency === "INR" ? "₹" : "$"}${(q.low * exchangeRate).toFixed(2)}` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Day Open:</span>{" "}
                            <span className="text-white font-semibold">
                              {q?.open ? `${currency === "INR" ? "₹" : "$"}${(q.open * exchangeRate).toFixed(2)}` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Prev Close:</span>{" "}
                            <span className="text-white font-semibold">
                              {q?.previousClose ? `${currency === "INR" ? "₹" : "$"}${(q.previousClose * exchangeRate).toFixed(2)}` : "N/A"}
                            </span>
                          </div>
                          {q?.currency && (
                            <div className="col-span-2 text-zinc-550 border-t border-zinc-900 pt-1">
                              Exchange currency: <span className="text-emerald-300 font-semibold">{q.currency}</span>
                            </div>
                          )}
                          {h.buyDate && (
                            <div className="col-span-2 text-zinc-550">
                              Logged purchase date: <span className="text-emerald-300 font-semibold">{h.buyDate}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-4 px-4 text-right font-mono text-zinc-350">
                      {isRowBeingEdited ? (
                        <input
                          type="number"
                          step="any"
                          className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-right font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          value={editQty}
                          onChange={(e) => setEditQty(parseFloat(e.target.value) || 0)}
                        />
                      ) : (
                        <span className="font-semibold text-zinc-300">{h.qty}</span>
                      )}
                    </td>

                    {/* Unit Buy Price */}
                    <td className="py-4 px-4 text-right font-mono">
                      {isRowBeingEdited ? (
                        <div className="relative inline-block">
                          <span className="absolute left-1.5 top-1 text-xs text-zinc-500 select-none">
                            {currency === "INR" ? "₹" : "$"}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 pl-5 pr-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-right font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            value={editBuyPrice}
                            onChange={(e) => setEditBuyPrice(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      ) : (
                        <div className="text-zinc-300 font-medium">
                          {currency === "INR" ? "₹" : "$"}{(h.buyPrice * exchangeRate).toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Total Cost Basis */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-zinc-300">
                      {isRowBeingEdited ? (
                        <span className="text-emerald-450 text-[11px] font-semibold">
                          {currency === "INR" ? "₹" : "$"}{(editQty * editBuyPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span>
                          {currency === "INR" ? "₹" : "$"}{(costBasisVal * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    {/* Unit Current Price */}
                    <td className="py-4 px-4 text-right font-mono">
                      {currentPrice !== null ? (
                        <div>
                          <div className="text-white font-medium">
                            {currency === "INR" ? "₹" : "$"}{(currentPrice * exchangeRate).toFixed(2)}
                          </div>
                          <div
                            className={`text-[10px] font-bold ${
                              isPriceUp ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPriceUp ? "+" : ""}{changeP?.toFixed(2)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-550 animate-pulse">Syncing...</span>
                      )}
                    </td>

                    {/* Total Market Value */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-white">
                      {isRowBeingEdited ? (
                        <span className="text-emerald-300 text-[11px] font-semibold">
                          {currentPrice !== null 
                            ? `${currency === "INR" ? "₹" : "$"}${(editQty * currentPrice * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "N/A"
                          }
                        </span>
                      ) : (
                        <span>
                          {currency === "INR" ? "₹" : "$"}{(marketVal * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>

                    {/* Total Gain/Loss */}
                    <td className="py-4 px-4 text-right font-mono">
                      {isRowBeingEdited ? (
                        (() => {
                          const tempCost = editQty * (editBuyPrice / exchangeRate); // baseline USD
                          const tempPrice = currentPrice !== null ? currentPrice : (editBuyPrice / exchangeRate);
                          const tempMarket = editQty * tempPrice;
                          const tempGL = tempMarket - tempCost;
                          const tempGLPercent = tempCost > 0 ? (tempGL / tempCost) * 100 : 0;
                          return (
                            <div>
                              <div className={`font-semibold text-[11px] ${tempGL >= 0 ? "text-emerald-450" : "text-rose-450"}`}>
                                {tempGL >= 0 ? "+" : ""}{currency === "INR" ? "₹" : "$"}{(tempGL * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className={`text-[10px] font-bold ${tempGL >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {tempGL >= 0 ? "+" : ""}{tempGLPercent.toFixed(2)}%
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div>
                          <div className={`font-bold ${unrealizedGL >= 0 ? "text-emerald-400" : "text-rose-450"}`}>
                            {unrealizedGL >= 0 ? "+" : ""}{currency === "INR" ? "₹" : "$"}{(unrealizedGL * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className={`text-[10px] font-bold ${unrealizedGL >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {unrealizedGL >= 0 ? "+" : ""}{unrealizedGLPercent.toFixed(2)}%
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Actions Strip */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isRowBeingEdited ? (
                          <>
                            <button
                              onClick={() => saveEdit(h.id)}
                              className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/10 transition-colors cursor-pointer"
                              title="Commit edits"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/10 transition-colors cursor-pointer"
                              title="Discard edits"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(h)}
                              className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer border border-zinc-700"
                              title="Edit position"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onDeleteHolding(h.id)}
                              className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-rose-450 hover:bg-rose-500/10 transition-colors cursor-pointer border border-zinc-700"
                              title="Liquidate position"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
