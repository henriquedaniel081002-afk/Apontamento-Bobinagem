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
      <div className="w-full space-y-1.5 sm:space-y-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-[11px]">
          {label}
        </label>
        <div className="relative">
          <select
            className={cn(
              "w-full appearance-none rounded-lg border bg-[#0A0B10] px-3 py-2.5 pr-10 text-base font-mono text-white outline-none transition-colors focus:border-emerald-500 sm:py-3 sm:text-xl",
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
              <Loader2 className="h-5 w-5 animate-spin text-slate-500 sm:h-6 sm:w-6" />
            </div>
          ) : (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="m6 9 6 6 6-6"/></svg>
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
