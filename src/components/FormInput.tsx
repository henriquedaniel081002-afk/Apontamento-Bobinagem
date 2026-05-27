import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  loading?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, label, error, loading, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 sm:space-y-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-[11px]">
          {label}
        </label>
        <div className="relative">
          <input
            className={cn(
              "w-full rounded-lg border bg-[#0A0B10] px-3 py-2.5 text-base font-mono text-white outline-none transition-colors placeholder:text-slate-700 focus:border-emerald-500 sm:py-3 sm:text-xl",
              error
                ? "border-rose-500/50 ring-1 ring-rose-500/10"
                : "border-slate-700",
              className
            )}
            ref={ref}
            {...props}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500 sm:h-6 sm:w-6" />
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
FormInput.displayName = "FormInput";
