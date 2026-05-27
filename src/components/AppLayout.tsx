import { ReactNode, useState, useEffect } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0A0B10] text-slate-200 font-sans flex flex-col overflow-hidden sm:h-screen">
      <header className="shrink-0 bg-[#151921] border-b border-slate-800 flex items-center justify-between gap-3 px-3 py-2 sm:h-16 sm:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-emerald-500 text-lg font-bold text-[#0A0B10] sm:h-10 sm:w-10 sm:text-xl">
            IT
          </div>
          <div>
            <h1 className="truncate text-[13px] font-bold leading-tight tracking-tight text-white uppercase sm:text-xl">ITAM <span className="text-emerald-500">- APONTAMENTO BOBINAGEM</span></h1>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-bold text-white">{date}</p>
            <p className="text-xs text-slate-500 font-mono">{time}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 gap-3 overflow-y-auto p-3 sm:overflow-hidden sm:p-4 lg:gap-6 lg:p-6">
        {children}
      </main>
    </div>
  );
}
