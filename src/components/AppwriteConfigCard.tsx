import { Database, AlertTriangle } from 'lucide-react';
import { appwriteConfig, isAppwriteConfigured } from '@/lib/appwrite';

export function AppwriteConfigCard() {
  const configured = isAppwriteConfigured();

  return (
    <div className={`rounded-2xl border p-4 text-xs ${configured ? 'border-slate-800 bg-[#151921]' : 'border-amber-500/30 bg-amber-500/10'}`}>
      <div className="flex items-center gap-2 font-black uppercase tracking-widest text-slate-300">
        {configured ? <Database className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}
        Configuração Appwrite
      </div>
      <div className="mt-3 grid gap-2 text-slate-400 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase text-slate-500">Project ID</p>
          <p className="break-all font-bold text-white">{appwriteConfig.projectId || 'vazio'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">Database ID</p>
          <p className={`break-all font-bold ${appwriteConfig.databaseId ? 'text-white' : 'text-amber-300'}`}>{appwriteConfig.databaseId || 'não configurado'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">Collections</p>
          <p className="break-all font-bold text-white">funcionarios / maquinas / ops / apontamentos</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">Status</p>
          <p className={`font-black ${configured ? 'text-emerald-400' : 'text-amber-300'}`}>{configured ? 'CONFIGURADO' : 'PENDENTE'}</p>
        </div>
      </div>
      {!configured && (
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-[#0A0B10] p-3 font-bold text-amber-200">
          Preencha o arquivo .env com o ID real do banco no Appwrite e reinicie o servidor com npm run dev.
        </p>
      )}
    </div>
  );
}
