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
      <div className="flex h-full w-full flex-col gap-5 overflow-hidden">
        <nav className="flex shrink-0 gap-3 rounded-2xl border border-slate-800 bg-[#151921] p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest transition',
                  active
                    ? 'bg-emerald-500 text-[#0A0B10] shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-hidden">
          {page === 'apontamento' && <ApontamentoPage />}
          {page === 'registros' && <ConsultaRegistrosPage />}
          {page === 'importacao' && <ImportacaoExcelPage />}
        </div>
      </div>
    </AppLayout>
  );
}
