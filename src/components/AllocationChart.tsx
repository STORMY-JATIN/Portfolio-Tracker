import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Holding, QuoteData } from "../types";
import { PieChart as PieIcon } from "lucide-react";

interface AllocationChartProps {
  holdings: Holding[];
  quotes: Record<string, QuoteData>;
  currency: "USD" | "INR";
  exchangeRate: number;
}

const COLORS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f59e0b", // Amber
  "#ec4899", // Pink
];

export default function AllocationChart({ holdings, quotes, currency, exchangeRate }: AllocationChartProps) {
  // Aggregate portfolio holdings and calculate active weights
  const data = holdings
    .map((h) => {
      const q = quotes[h.symbol];
      const currentPrice = q && q.success ? q.price : h.buyPrice;
      const value = currentPrice * h.qty * exchangeRate;
      return {
        name: h.symbol,
        value: parseFloat(value.toFixed(2)),
      };
    })
    .filter((d) => d.value > 0);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  const chartData = data.map((item) => ({
    ...item,
    percentage: totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : "0",
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-[#141417] rounded-[24px] border border-zinc-800 p-6 flex flex-col items-center justify-center min-h-[320px]">
        <PieIcon className="w-10 h-10 text-zinc-700 mb-2" />
        <p className="text-sm text-zinc-500 font-medium font-sans">No active assets to allocate</p>
      </div>
    );
  }

  // Custom formatted tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#141417] text-white text-xs px-3 py-2 rounded-lg font-mono shadow-md border border-zinc-800">
          <div className="font-bold">{data.name}</div>
          <div className="mt-0.5 text-emerald-400">{currency === "INR" ? "₹" : "$"}{data.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-[10px] text-zinc-500 font-medium">{data.percentage}% of portfolio</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#141417] rounded-[24px] border border-zinc-800 p-6 flex flex-col justify-between min-h-[320px]">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="w-4 h-4 text-emerald-400" />
        <h3 className="font-display font-semibold text-base text-white">
          Asset Allocation
        </h3>
      </div>

      <div className="h-48 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#141417" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center overlay for donut */}
        <div className="absolute inset-x-0 top-[35%] flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Value</span>
          <span className="text-sm font-mono font-bold text-white">
            {currency === "INR" ? "₹" : "$"}{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {/* Customized Legend */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        {chartData.map((item, index) => (
          <div key={item.name} className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="font-mono font-bold text-zinc-300">{item.name}</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
