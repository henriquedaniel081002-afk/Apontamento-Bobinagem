import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InfoCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "success" | "warning" | "error" | "neutral";
}

export function InfoCard({ title, icon, children, className, variant = "neutral" }: InfoCardProps) {
  let bgBorder = "border-slate-800";
  let titleColor = "text-slate-500";
  let dotColor = "bg-slate-500";
  let bgCard = "bg-[#151921]";
  
  if (variant === "success") {
    bgBorder = "border-emerald-500/30";
    titleColor = "text-emerald-500";
    dotColor = "bg-emerald-500";
  } else if (variant === "warning") {
    bgBorder = "border-amber-500/30";
    titleColor = "text-amber-500";
    dotColor = "bg-amber-500";
  } else if (variant === "error") {
    bgBorder = "border-rose-500/30";
    titleColor = "text-rose-500";
    dotColor = "bg-rose-500";
  }

  return (
    <div className={cn(`${bgCard} rounded-xl border ${bgBorder} p-3 relative overflow-hidden`, className)}>
      <h3 className={`text-[10px] font-bold ${titleColor} uppercase tracking-widest mb-2 flex items-center gap-1`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span> {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  );
}

export function InfoRow({ label, value, highlight = false, error = false, colSpan = 1 }: { label: string; value: ReactNode; highlight?: boolean; error?: boolean; colSpan?: number }) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <p className={cn(
        "text-sm font-bold",
        highlight ? "text-blue-400 font-mono" : "text-white",
        error ? "text-rose-400" : ""
      )}>
        {value || "-"}
      </p>
    </div>
  );
}

export function InfoAlert({ children, variant = "warning" }: { children: ReactNode; variant?: "warning" | "error" }) {
  const bg = variant === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-200/80" : "bg-rose-500/10 border-rose-500/20 text-rose-200/80";
  return (
    <div className={cn("col-span-2 p-2 rounded border", bg)}>
      <p className="text-[10px] leading-tight italic">{children}</p>
    </div>
  );
}
