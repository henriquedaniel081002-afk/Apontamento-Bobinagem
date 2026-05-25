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
    <div className="h-full w-full bg-[#0A0B10] text-slate-200 font-sans flex flex-col overflow-hidden">
      <header className="h-16 bg-[#151921] border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded flex items-center justify-center text-[#0A0B10] font-bold text-xl">
            IT
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">ITAM <span className="text-emerald-500">- APONTAMENTO BOBINAGEM</span></h1>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-bold text-white">{date}</p>
            <p className="text-xs text-slate-500 font-mono">{time}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex p-6 gap-6 overflow-hidden max-w-[1400px] w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
