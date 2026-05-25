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
      <div className="space-y-2 w-full">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          {label}
        </label>
        <div className="relative">
          <input
            className={cn(
              "w-full bg-[#0A0B10] border rounded-lg py-3 px-3 text-xl font-mono text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-700",
              error
                ? "border-rose-500/50 ring-1 ring-rose-500/10"
                : "border-slate-700",
              className
            )}
            ref={ref}
            {...props}
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
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
