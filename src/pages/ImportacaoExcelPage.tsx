import { ChangeEvent, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, RefreshCcw, UploadCloud } from 'lucide-react';
import { parseExcelFile, syncExcelBases } from '@/utils/excelImport';
import type { ExcelPreview, SyncSummaryItem } from '@/types';

function SummaryCard({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#151921] p-3 sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-black text-white sm:mt-2 sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{detail}</p>
    </div>
  );
}

function IssuesBox({ title, issues }: { title: string; issues: { sheet: string; row?: number; message: string }[] }) {
  if (!issues.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-300 sm:text-sm">
        <AlertCircle className="h-5 w-5" />
        {title}
      </h3>
      <div className="max-h-52 overflow-y-auto pr-2">
        {issues.map((issue, index) => (
          <p key={`${issue.sheet}-${issue.row}-${index}`} className="border-b border-amber-500/10 py-2 text-xs text-amber-100/90">
            <span className="font-bold uppercase">{issue.sheet}</span>
            {issue.row ? ` - linha ${issue.row}` : ''}: {issue.message}
          </p>
        ))}
      </div>
    </div>
  );
}

function SyncTable({ results }: { results: SyncSummaryItem[] }) {
  if (!results.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#151921]">
      <div className="border-b border-slate-800 px-3 py-3 sm:px-5 sm:py-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400">Resultado da sincronização</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-xs sm:text-sm">
          <thead className="bg-[#0A0B10] text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Base</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Criados</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Atualizados</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Inativados</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Excluídos</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Sem alteração</th>
              <th className="px-3 py-2.5 sm:px-5 sm:py-3">Erros</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {results.map((item) => (
              <tr key={item.collection}>
                <td className="px-3 py-3 font-bold uppercase text-white sm:px-5 sm:py-4">{item.collection}</td>
                <td className="px-3 py-3 text-emerald-400 sm:px-5 sm:py-4">{item.created}</td>
                <td className="px-3 py-3 text-blue-400 sm:px-5 sm:py-4">{item.updated}</td>
                <td className="px-3 py-3 text-amber-400 sm:px-5 sm:py-4">{item.inactivated}</td>
                <td className="px-3 py-3 text-rose-300 sm:px-5 sm:py-4">{item.deleted}</td>
                <td className="px-3 py-3 text-slate-400 sm:px-5 sm:py-4">{item.unchanged}</td>
                <td className="px-3 py-3 text-rose-400 sm:px-5 sm:py-4">{item.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ImportacaoExcelPage() {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [results, setResults] = useState<SyncSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setResults([]);
    setError('');

    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    try {
      const parsed = await parseExcelFile(file);
      setPreview(parsed);

      const hasStructuralIssue = parsed.issues.some((issue) => issue.message.includes('não encontrada'));
      if (hasStructuralIssue) {
        setError('O Excel precisa conter as abas funcionarios, maquinas e ops. Corrija o arquivo antes de sincronizar.');
      }
    } catch (err) {
      console.error(err);
      setError('Não foi possível ler o Excel. Confirme se o arquivo está no formato .xlsx ou .xls.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!preview) return;
    setSyncing(true);
    setError('');
    setResults([]);

    try {
      const syncResults = await syncExcelBases(preview);
      setResults(syncResults);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar com o Appwrite. Verifique permissões, IDs das collections e conexão.');
    } finally {
      setSyncing(false);
    }
  };


  const hasBlockingIssues = Boolean(error) || !preview || preview.issues.some((issue) => issue.message.includes('Coluna obrigatória') || issue.message.includes('não encontrada'));

  return (
    <div className="flex min-h-0 w-full flex-col gap-3 overflow-visible sm:h-full sm:gap-5 sm:overflow-y-auto sm:pr-2">
      <section className="rounded-2xl border border-slate-800 bg-[#151921] p-4 shadow-2xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 sm:h-12 sm:w-12">
              <FileSpreadsheet className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl">Importação Excel</h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-400 sm:text-sm">
              Sincronize somente as bases auxiliares necessárias para os apontamentos.
            </p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs font-bold text-blue-300 sm:p-4 sm:text-sm">
          Lendo e validando Excel...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-300 sm:items-center sm:gap-3 sm:p-4 sm:text-sm">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-[#151921] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-black uppercase tracking-tight text-white sm:text-lg">Bases auxiliares</h3>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Espera abas funcionarios, maquinas e ops. Funcionários/máquinas ausentes são inativados; OPs ausentes são excluídas.
            </p>
          </div>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0A0B10] px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:border-emerald-500 hover:text-emerald-400 sm:w-auto sm:gap-3 sm:px-6 sm:py-4 sm:text-sm">
            <UploadCloud className="h-5 w-5" />
            Selecionar bases
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {fileName && (
          <div className="mt-4 break-words rounded-xl border border-slate-800 bg-[#0A0B10] px-3 py-2.5 text-xs text-slate-300 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
            Arquivo selecionado: <span className="font-bold text-white">{fileName}</span>
          </div>
        )}

        {preview && (
          <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              <SummaryCard title="Funcionários" value={preview.funcionarios.length} detail="registros válidos no Excel" />
              <SummaryCard title="Máquinas" value={preview.maquinas.length} detail="registros válidos no Excel" />
              <SummaryCard title="OPs" value={preview.ops.length} detail="registros válidos no Excel" />
            </div>
            <IssuesBox title="Pontos encontrados na validação" issues={preview.issues} />
            <button
              type="button"
              disabled={hasBlockingIssues || syncing}
              onClick={handleSync}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-[#0A0B10] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:gap-3 sm:px-6 sm:py-4 sm:text-sm"
            >
              {syncing ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar bases'}
            </button>
          </div>
        )}
      </section>

      <SyncTable results={results} />
    </div>
  );
}
