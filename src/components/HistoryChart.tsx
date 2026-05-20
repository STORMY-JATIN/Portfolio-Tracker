import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { HistoryPoint } from "../types";
import { LineChart as ChartIcon, Loader2, Calendar } from "lucide-react";

interface HistoryChartProps {
  history: HistoryPoint[];
  loading: boolean;
  currency: "USD" | "INR";
  exchangeRate: number;
}

export default function HistoryChart({ history, loading, currency, exchangeRate }: HistoryChartProps) {
  // Safe formatting for dates: e.g. "May 20"
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    const symbol = currency === "INR" ? "₹" : "$";
    return `${symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <div className="bg-[#141417] rounded-[24px] border border-zinc-800 p-6 flex flex-col items-center justify-center min-h-[320px]">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <p className="text-sm text-zinc-500 font-medium font-sans">Compiling historical valuations...</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-[#141417] rounded-[24px] border border-zinc-800 p-6 flex flex-col items-center justify-center min-h-[320px]">
        <ChartIcon className="w-10 h-10 text-zinc-700 mb-2" />
        <p className="text-sm text-zinc-500 font-medium font-sans">History chart will populate as assets update</p>
      </div>
    );
  }

  // Map the props to active currency scaled values
  const convertedHistory = (history || []).map((pt) => ({
    ...pt,
    value: pt.value * exchangeRate,
    cost: pt.cost * exchangeRate,
    gainLoss: pt.gainLoss * exchangeRate,
  }));

  // Calculate some bounds for y-axis padding
  const values = convertedHistory.map((h) => h.value);
  const costs = convertedHistory.map((h) => h.cost);
  const allValues = [...values, ...costs];
  const minValue = Math.min(...allValues) * 0.95;
  const maxValue = Math.max(...allValues) * 1.05;

  const costBasis = convertedHistory[convertedHistory.length - 1]?.cost ?? 0;
  const currentVal = convertedHistory[convertedHistory.length - 1]?.value ?? 0;
  const gainLoss = currentVal - costBasis;
  const gainPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

  return (
    <div className="bg-[#141417] rounded-[24px] border border-zinc-800 p-6 flex flex-col justify-between min-h-[320px]">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <ChartIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display font-semibold text-base text-white">
              30-Day Value Performance
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>Aggregate Trend</span>
          </div>
        </div>
        
        {/* Quick historical stats summary in chart card header */}
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-2xl font-black text-white">
            {formatCurrency(currentVal)}
          </span>
          <span className={`text-xs font-mono font-bold ${gainLoss >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {gainLoss >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(gainLoss))} ({gainPercent >= 0 ? "+" : ""}{gainPercent.toFixed(2)}%)
          </span>
          <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider ml-auto">Cost basis: {formatCurrency(costBasis)}</span>
        </div>
      </div>

      <div className="h-48 w-full mt-2 font-mono text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={convertedHistory} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#71717a"
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              domain={[parseFloat(minValue.toFixed(0)), parseFloat(maxValue.toFixed(0))]}
              tickFormatter={formatCurrency}
              stroke="#71717a"
              tickLine={false}
              axisLine={false}
              dx={-8}
            />
            <Tooltip
              labelFormatter={formatDate}
              formatter={(value: any) => {
                const symbol = currency === "INR" ? "₹" : "$";
                return [`${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Portfolio Value"];
              }}
              contentStyle={{
                backgroundColor: "#141417",
                borderRadius: "12px",
                border: "1px solid #27272a",
                color: "#fff",
                fontSize: "11px",
              }}
            />
            {/* Draw a subtle dashed cost reference line */}
            <ReferenceLine y={costBasis} stroke="#3f3f46" strokeDasharray="4 4" label={{ value: 'Cost', position: 'insideRight', fill: '#71717a', fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={{ r: 5, strokeWidth: 0, fill: "#059669" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
