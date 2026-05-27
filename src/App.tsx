import { useState } from 'react';
import { ClipboardList, FileSpreadsheet } from 'lucide-react';
import { AppLayout } from './components/AppLayout';
import { ApontamentoPage } from './pages/ApontamentoPage';
import { ImportacaoExcelPage } from './pages/ImportacaoExcelPage';
import { ConsultaRegistrosPage } from './pages/ConsultaRegistrosPage';
import { cn } from './lib/utils';

type Page = 'apontamento' | 'registros' | 'importacao';

const navItems = [
  { id: 'apontamento' as const, label: 'Apontamento', icon: ClipboardList },
  { id: 'registros' as const, label: 'Registros', icon: ClipboardList },
  { id: 'importacao' as const, label: 'Importação Excel', icon: FileSpreadsheet },
];

export default function App() {
  const [page, setPage] = useState<Page>('apontamento');

  return (
    <AppLayout>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-visible sm:h-full sm:gap-5 sm:overflow-hidden">
        <nav className="flex shrink-0 gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-[#151921] p-1.5 sm:gap-3 sm:p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={cn(
                  'flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-widest transition sm:flex-none sm:px-5 sm:py-3 sm:text-xs',
                  active
                    ? 'bg-emerald-500 text-[#0A0B10] shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-visible sm:overflow-hidden">
          {page === 'apontamento' && <ApontamentoPage />}
          {page === 'registros' && <ConsultaRegistrosPage />}
          {page === 'importacao' && <ImportacaoExcelPage />}
        </div>
      </div>
    </AppLayout>
  );
}
