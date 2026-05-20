import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Wallet, Percent, Briefcase } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  isPositive?: boolean;
  type: "currency" | "gain" | "day" | "invested";
}

export default function MetricCard({ label, value, subValue, isPositive, type }: MetricCardProps) {
  const isGainLoss = type === "gain" || type === "day";

  // Match icon and styling based on type
  const getStyle = () => {
    switch (type) {
      case "currency":
        return {
          icon: <Wallet className="w-4 h-4 text-emerald-400" />,
          glow: "border-zinc-800",
        };
      case "invested":
        return {
          icon: <Briefcase className="w-4 h-4 text-blue-400" />,
          glow: "border-zinc-800",
        };
      case "gain":
      case "day":
        if (isPositive === undefined) {
          return {
            icon: <Percent className="w-4 h-4 text-zinc-400" />,
            glow: "border-zinc-800",
          };
        }
        return {
          icon: isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
          ),
          glow: isPositive ? "border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.05)]" : "border-rose-500/20 shadow-[0_0_15px_-3px_rgba(244,63,94,0.05)]",
        };
    }
  };

  const style = getStyle();

  return (
    <div className={`rounded-[24px] border p-5 bg-[#141417] transition-all duration-300 hover:border-zinc-700 ${style.glow}`}>
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
          {label}
        </span>
        <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          {style.icon}
        </div>
      </div>
      
      <div className="space-y-1.5">
        <h4 className="font-display font-bold text-2xl text-white tracking-tight">
          {value}
        </h4>
        {subValue && (
          <div className="flex items-center gap-1.5">
            {isGainLoss && isPositive !== undefined ? (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md font-mono ${
                isPositive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" : "bg-rose-500/10 text-rose-400 border border-rose-500/10"
              }`}>
                {isPositive ? "+" : ""}{subValue}
              </span>
            ) : (
              <span className="text-xs text-zinc-500 font-sans font-medium">
                {subValue}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
