import { forwardRef, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  loading?: boolean;
  options: { value: string; label: string }[];
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className, label, error, loading, options, ...props }, ref) => {
    return (
      <div className="space-y-2 w-full">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          {label}
        </label>
        <div className="relative">
          <select
            className={cn(
              "w-full bg-[#0A0B10] border rounded-lg py-3 px-3 pr-10 text-xl font-mono text-white outline-none transition-colors appearance-none focus:border-emerald-500",
              error
                ? "border-rose-500/50 ring-1 ring-rose-500/10"
                : "border-slate-700",
              className
            )}
            ref={ref}
            {...props}
          >
            <option value="" disabled className="text-slate-500 bg-[#151921] font-sans text-base">Selecione...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#151921] text-base font-sans">
                {opt.label}
              </option>
            ))}
          </select>
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#0A0B10] pl-2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          )}
        </div>
        {error && (
           <p className="text-[11px] font-bold text-rose-500 uppercase">{error}</p>
        )}
      </div>
    );
  }
);
FormSelect.displayName = "FormSelect";
