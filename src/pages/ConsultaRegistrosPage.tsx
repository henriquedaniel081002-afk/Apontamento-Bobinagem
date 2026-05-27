import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ClipboardList,
  Edit3,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  atualizarApontamento,
  excluirApontamento,
  excluirTodosApontamentos,
  listarApontamentos,
} from "@/services/apontamentosService";
import { listarFuncionarios } from "@/services/funcionariosService";
import type { Apontamento, Funcionario } from "@/types";
import { cn } from "@/lib/utils";
import {
  calcularTempoProduzido,
  derivarTipoEnrolamentoPorMaquina,
  descreverTipoEnrolamento,
} from "@/utils/produtividade";
import {
  adicionarMarcadorSaldoBobinagem,
  extrairSaldoBobinagem,
  limparMarcadoresSaldoBobinagem,
  getQuantidadeContabilizadaBobinagem,
  getQuantidadeFisicaApontadaBobinagem,
  getSaldoPendenteBobinagem,
} from "@/utils/quantidadeBobinagem";

const formatarData = (iso?: string) => {
  if (!iso) return "-";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR");
};

const getDataChave = (iso?: string) => {
  if (!iso) return "SEM_DATA";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "SEM_DATA";
  return data.toISOString().slice(0, 10);
};

const normalizar = (valor?: string | number) =>
  String(valor ?? "")
    .trim()
    .toLowerCase();
const getLinha = (a: Apontamento) => a.linha || a.linha_manual || "-";
const getDesenho = (a: Apontamento) => a.desenho || a.desenho_manual || "-";
const getPotencia = (a: Apontamento) => a.potencia || a.potencia_manual || "-";
const getSetor = (a: Apontamento) => a.setor_maquina || a.setor_operador || "-";
const getTipoApontamento = (a: Apontamento) =>
  a.tipo_apontamento === "REFORMA" ? "Reforma sem OP" : "Produção com OP";
const getTipoEnrolamento = (a: Apontamento) =>
  descreverTipoEnrolamento(
    a.tipo_enrolamento || derivarTipoEnrolamentoPorMaquina(a.maquina),
  );

const campoFiltro =
  "w-full rounded-xl border border-slate-700 bg-[#0A0B10] px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-emerald-500 sm:py-3";

type RegistroEditavel = {
  data_apontamento: string;
  matricula: string;
  nome_operador: string;
  turno: string;
  maquina: string;
  setor_maquina: string;
  tipo_apontamento: "PRODUCAO" | "REFORMA";
  tipo_enrolamento: string;
  op: string;
  desenho: string;
  desenho_manual: string;
  potencia: string;
  potencia_manual: string;
  linha: string;
  linha_manual: string;
  qtd_produzida: string;
  qtd_apontada: string;
  qtd_saldo: string;
  obs: string;
};

const toDateInputValue = (iso?: string) => {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toISOString().slice(0, 10);
};

const montarRegistroEditavel = (registro: Apontamento): RegistroEditavel => ({
  data_apontamento: toDateInputValue(registro.data_apontamento),
  matricula: registro.matricula || "",
  nome_operador: registro.nome_operador || "",
  turno: registro.turno || "",
  maquina: registro.maquina || "",
  setor_maquina: registro.setor_maquina || "",
  tipo_apontamento: registro.tipo_apontamento || "PRODUCAO",
  tipo_enrolamento: registro.tipo_enrolamento || derivarTipoEnrolamentoPorMaquina(registro.maquina) || "",
  op: registro.op || "",
  desenho: registro.desenho || "",
  desenho_manual: registro.desenho_manual || "",
  potencia: registro.potencia || "",
  potencia_manual: registro.potencia_manual || "",
  linha: registro.linha || "",
  linha_manual: registro.linha_manual || "",
  qtd_produzida: String(getQuantidadeContabilizadaBobinagem(registro) ?? ""),
  qtd_apontada: String(getQuantidadeFisicaApontadaBobinagem(registro) ?? ""),
  qtd_saldo: String(getSaldoPendenteBobinagem(registro) ?? ""),
  obs: limparMarcadoresSaldoBobinagem(registro.obs),
});

function FiltroInput({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5 sm:space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ConsultaRegistrosPage() {
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [setorFiltro, setSetorFiltro] = useState("");
  const [nomeFiltro, setNomeFiltro] = useState("");
  const [maquinaFiltro, setMaquinaFiltro] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState("");
  const [desenhoFiltro, setDesenhoFiltro] = useState("");
  const [opFiltro, setOpFiltro] = useState("");
  const [linhaFiltro, setLinhaFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [apagandoTodos, setApagandoTodos] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<Apontamento | null>(
    null,
  );
  const [formEdicao, setFormEdicao] = useState<RegistroEditavel | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    setError("");
    try {
      const [apontamentosData, funcionariosData] = await Promise.all([
        listarApontamentos(),
        listarFuncionarios(),
      ]);
      setApontamentos(apontamentosData);
      setFuncionarios(funcionariosData);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Erro ao carregar registros.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const funcionariosPorMatricula = useMemo(
    () => new Map(funcionarios.map((f) => [f.matricula, f])),
    [funcionarios],
  );

  const opcoes = useMemo(() => {
    const setores = new Set<string>();
    const maquinas = new Set<string>();
    const turnos = new Set<string>();
    const linhas = new Set<string>();

    apontamentos.forEach((a) => {
      const funcionario = funcionariosPorMatricula.get(a.matricula);
      const setor = getSetor(a);
      const turno = a.turno || funcionario?.turno || "";
      const linha = getLinha(a);
      if (setor && setor !== "-") setores.add(setor);
      if (a.maquina) maquinas.add(a.maquina);
      if (turno) turnos.add(turno);
      if (linha && linha !== "-") linhas.add(linha);
    });

    return {
      setores: Array.from(setores).sort(),
      maquinas: Array.from(maquinas).sort(),
      turnos: Array.from(turnos).sort(),
      linhas: Array.from(linhas).sort(),
    };
  }, [apontamentos, funcionariosPorMatricula]);

  const registrosFiltrados = useMemo(() => {
    return apontamentos.filter((a) => {
      const data = getDataChave(a.data_apontamento);
      const funcionario = funcionariosPorMatricula.get(a.matricula);
      const nome = a.nome_operador || funcionario?.nome || "";
      const turno = a.turno || funcionario?.turno || "";
      const desenho = getDesenho(a);
      const op = a.op || "";
      const linha = getLinha(a);
      const setor = getSetor(a);

      if (dataInicio && data < dataInicio) return false;
      if (dataFim && data > dataFim) return false;
      if (setorFiltro && setor !== setorFiltro) return false;
      if (nomeFiltro && !normalizar(nome).includes(normalizar(nomeFiltro)))
        return false;
      if (maquinaFiltro && a.maquina !== maquinaFiltro) return false;
      if (turnoFiltro && turno !== turnoFiltro) return false;
      if (
        desenhoFiltro &&
        !normalizar(desenho).includes(normalizar(desenhoFiltro))
      )
        return false;
      if (opFiltro && !normalizar(op).includes(normalizar(opFiltro))) return false;
      if (linhaFiltro && linha !== linhaFiltro) return false;
      if (tipoFiltro && a.tipo_apontamento !== tipoFiltro) return false;
      return true;
    });
  }, [
    apontamentos,
    dataFim,
    dataInicio,
    desenhoFiltro,
    funcionariosPorMatricula,
    linhaFiltro,
    maquinaFiltro,
    opFiltro,
    nomeFiltro,
    setorFiltro,
    tipoFiltro,
    turnoFiltro,
  ]);

  const excluirRegistro = async (registro: Apontamento) => {
    if (!registro.$id) {
      setError("Não foi possível excluir: registro sem ID do Appwrite.");
      return;
    }

    const nome =
      registro.nome_operador ||
      funcionariosPorMatricula.get(registro.matricula)?.nome ||
      registro.matricula;
    const confirmado = window.confirm(
      `Deseja realmente apagar definitivamente da base Appwrite o apontamento de ${nome} do dia ${formatarData(registro.data_apontamento)}?`,
    );
    if (!confirmado) return;

    setExcluindoId(registro.$id);
    setError("");
    try {
      await excluirApontamento(registro.$id);
      setApontamentos((atual) =>
        atual.filter((item) => item.$id !== registro.$id),
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Erro ao excluir registro.",
      );
    } finally {
      setExcluindoId(null);
    }
  };

  const apagarTodosRegistros = async () => {
    if (apontamentos.length === 0) {
      setError("Não há registros para apagar na base apontamentos.");
      return;
    }

    const primeiraConfirmacao = window.confirm(
      `ATENÇÃO: isso vai apagar definitivamente todos os registros da base apontamentos no Appwrite. Deseja continuar?`,
    );
    if (!primeiraConfirmacao) return;

    const segundaConfirmacao = window.prompt(
      "Para confirmar o apagamento da base de dados apontamentos, digite APAGAR:",
    );
    if (segundaConfirmacao !== "APAGAR") {
      setError("Apagamento cancelado. A confirmação digitada não foi APAGAR.");
      return;
    }

    setApagandoTodos(true);
    setError("");
    try {
      const total = await excluirTodosApontamentos();
      setApontamentos([]);
      window.alert(`${total} registro(s) apagado(s) definitivamente da base apontamentos no Appwrite.`);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao apagar todos os registros.",
      );
    } finally {
      setApagandoTodos(false);
    }
  };

  const abrirEdicao = (registro: Apontamento) => {
    setRegistroEditando(registro);
    setFormEdicao(montarRegistroEditavel(registro));
    setError("");
  };

  const fecharEdicao = () => {
    setRegistroEditando(null);
    setFormEdicao(null);
    setSalvandoEdicao(false);
  };

  const atualizarCampoEdicao = (
    campo: keyof RegistroEditavel,
    valor: string,
  ) => {
    setFormEdicao((atual) => (atual ? { ...atual, [campo]: valor } : atual));
  };

  const salvarEdicao = async () => {
    if (!registroEditando?.$id || !formEdicao) return;

    const qtd = Number(formEdicao.qtd_produzida);
    const qtdApontada = Number(formEdicao.qtd_apontada);
    const qtdSaldo = Number(formEdicao.qtd_saldo);
    if (!formEdicao.data_apontamento) {
      setError("Informe a data do apontamento antes de salvar.");
      return;
    }
    if (!formEdicao.matricula.trim()) {
      setError("Informe a matrícula antes de salvar.");
      return;
    }
    if (!formEdicao.maquina.trim()) {
      setError("Informe a máquina antes de salvar.");
      return;
    }
    if (!Number.isFinite(qtd) || qtd < 0) {
      setError("A quantidade produzida deve ser zero ou maior.");
      return;
    }
    if (!Number.isFinite(qtdApontada) || qtdApontada < 0) {
      setError("A quantidade apontada deve ser zero ou maior.");
      return;
    }
    if (!Number.isFinite(qtdSaldo) || qtdSaldo < 0) {
      setError("A quantidade de saldo deve ser zero ou maior.");
      return;
    }

    const linhaEditada = formEdicao.tipo_apontamento === "REFORMA"
      ? formEdicao.linha_manual || formEdicao.linha
      : formEdicao.linha;
    const saldoTecnico = extrairSaldoBobinagem(registroEditando.obs);
    const fatorSaldo = saldoTecnico?.fator || (linhaEditada.trim().toUpperCase() === "MON" ? 2 : linhaEditada.trim().toUpperCase() === "TRI" ? 3 : 1);
    const deveSalvarSaldoTecnico = formEdicao.tipo_apontamento === "PRODUCAO" && fatorSaldo > 1;
    const obsEditada = deveSalvarSaldoTecnico
      ? adicionarMarcadorSaldoBobinagem(
          formEdicao.obs,
          fatorSaldo,
          qtdSaldo,
          qtd,
          qtdApontada,
        )
      : limparMarcadoresSaldoBobinagem(formEdicao.obs);

    setSalvandoEdicao(true);
    setError("");
    try {
      const payload = {
        data_apontamento: new Date(
          `${formEdicao.data_apontamento}T12:00:00`,
        ).toISOString(),
        matricula: formEdicao.matricula.trim(),
        nome_operador: formEdicao.nome_operador.trim(),
        turno: formEdicao.turno.trim(),
        maquina: formEdicao.maquina.trim(),
        setor_maquina: formEdicao.setor_maquina.trim(),
        tipo_apontamento: formEdicao.tipo_apontamento,
        tipo_enrolamento: formEdicao.tipo_enrolamento,
        op: formEdicao.op.trim(),
        desenho: formEdicao.desenho.trim(),
        desenho_manual: formEdicao.desenho_manual.trim(),
        potencia: formEdicao.potencia.trim(),
        potencia_manual: formEdicao.potencia_manual.trim(),
        linha: formEdicao.linha.trim(),
        linha_manual: formEdicao.linha_manual.trim(),
        qtd_produzida: qtd,
        obs: obsEditada,
      };

      const atualizado = await atualizarApontamento(
        registroEditando.$id,
        payload,
      );
      setApontamentos((atual) =>
        atual.map((item) =>
          item.$id === registroEditando.$id ? { ...item, ...atualizado } : item,
        ),
      );
      fecharEdicao();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao editar registro.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const limparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setSetorFiltro("");
    setNomeFiltro("");
    setMaquinaFiltro("");
    setTurnoFiltro("");
    setDesenhoFiltro("");
    setOpFiltro("");
    setLinhaFiltro("");
    setTipoFiltro("");
  };

  const exportarExcel = () => {
    if (registrosFiltrados.length === 0) {
      setError("Não há registros para exportar com os filtros aplicados.");
      return;
    }

    const linhas = registrosFiltrados.map((a) => {
      const funcionario = funcionariosPorMatricula.get(a.matricula);
      return {
        data: formatarData(a.data_apontamento),
        matricula: a.matricula || "",
        maquina: a.maquina || "",
        "nome colaborador": a.nome_operador || funcionario?.nome || "",
        op: a.op || "",
        desenho: getDesenho(a),
        linha: getLinha(a),
        potencia: getPotencia(a),
        "qtde apontada": getQuantidadeFisicaApontadaBobinagem(a),
        "qtde produzida": getQuantidadeContabilizadaBobinagem(a),
        "qtde saldo": getSaldoPendenteBobinagem(a),
        "tempo produzido": Number(calcularTempoProduzido(a).toFixed(2)),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(linhas, {
      header: [
        "data",
        "matricula",
        "maquina",
        "nome colaborador",
        "op",
        "desenho",
        "linha",
        "potencia",
        "qtde apontada",
        "qtde produzida",
        "qtde saldo",
        "tempo produzido",
      ],
    });

    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "apontamentos");

    const periodo = `${dataInicio || "inicio"}_${dataFim || "fim"}`;
    const maquina = maquinaFiltro
      ? maquinaFiltro.replace(/[^a-zA-Z0-9_-]/g, "")
      : "todas-maquinas";
    XLSX.writeFile(workbook, `apontamentos_${periodo}_${maquina}.xlsx`);
  };

  return (
    <div className="flex min-h-0 w-full flex-col gap-3 overflow-visible sm:h-full sm:gap-5 sm:overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-wide text-white sm:text-lg">
            <ClipboardList className="h-5 w-5 text-emerald-400" />
            Consulta de Registros
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">
            Consulta os apontamentos salvos no Appwrite e exporta Excel filtrado
            por data, máquina e demais filtros operacionais.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setFiltrosAbertos((atual) => !atual)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-black uppercase tracking-widest transition sm:px-4 sm:py-3 sm:text-xs",
              filtrosAbertos
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-slate-700 bg-[#151921] text-slate-300 hover:border-emerald-500 hover:text-emerald-400",
            )}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
          <button
            type="button"
            onClick={exportarExcel}
            disabled={loading || registrosFiltrados.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#0A0B10] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-3 sm:text-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={apagarTodosRegistros}
            disabled={loading || apagandoTodos || apontamentos.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-3 sm:text-xs"
          >
            <Trash2 className="h-4 w-4" />
            {apagandoTodos ? "Apagando..." : "Apagar todos"}
          </button>
          <button
            type="button"
            onClick={carregarDados}
            disabled={loading || apagandoTodos}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#151921] px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-300 transition hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-xs"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-400 sm:items-center sm:gap-3 sm:p-4 sm:text-sm">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {filtrosAbertos && (
        <div className="shrink-0 rounded-2xl border border-slate-800 bg-[#151921] p-3 shadow-2xl sm:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
              <Filter className="h-4 w-4 text-emerald-400" />
              Filtros
            </h3>
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                {registrosFiltrados.length} registro(s)
              </span>
              <button
                type="button"
                onClick={limparFiltros}
                className="text-xs font-black uppercase tracking-widest text-slate-500 transition hover:text-emerald-400"
              >
                Limpar filtros
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FiltroInput label="Data inicial">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={campoFiltro}
              />
            </FiltroInput>
            <FiltroInput label="Data final">
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={campoFiltro}
              />
            </FiltroInput>
            <FiltroInput label="Setor">
              <select
                value={setorFiltro}
                onChange={(e) => setSetorFiltro(e.target.value)}
                className={campoFiltro}
              >
                <option value="">Todos</option>
                {opcoes.setores.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </FiltroInput>
            <FiltroInput label="Nome colaborador">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  value={nomeFiltro}
                  onChange={(e) => setNomeFiltro(e.target.value)}
                  placeholder="Buscar nome"
                  className={cn(campoFiltro, "pl-9")}
                />
              </div>
            </FiltroInput>
            <FiltroInput label="Máquina">
              <select
                value={maquinaFiltro}
                onChange={(e) => setMaquinaFiltro(e.target.value)}
                className={campoFiltro}
              >
                <option value="">Todas</option>
                {opcoes.maquinas.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </FiltroInput>
            <FiltroInput label="Turno">
              <select
                value={turnoFiltro}
                onChange={(e) => setTurnoFiltro(e.target.value)}
                className={campoFiltro}
              >
                <option value="">Todos</option>
                {opcoes.turnos.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </FiltroInput>
            <FiltroInput label="Desenho">
              <input
                value={desenhoFiltro}
                onChange={(e) => setDesenhoFiltro(e.target.value)}
                placeholder="Buscar desenho"
                className={campoFiltro}
              />
            </FiltroInput>
            <FiltroInput label="OP">
              <input
                value={opFiltro}
                onChange={(e) => setOpFiltro(e.target.value)}
                placeholder="Buscar OP"
                className={campoFiltro}
              />
            </FiltroInput>
            <FiltroInput label="Linha">
              <select
                value={linhaFiltro}
                onChange={(e) => setLinhaFiltro(e.target.value)}
                className={campoFiltro}
              >
                <option value="">Todas</option>
                {opcoes.linhas.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </FiltroInput>
            <FiltroInput label="Tipo apontamento">
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className={campoFiltro}
              >
                <option value="">Todos</option>
                <option value="PRODUCAO">Produção com OP</option>
                <option value="REFORMA">Reforma sem OP</option>
              </select>
            </FiltroInput>
          </div>
        </div>
      )}

      <div className="min-h-[55vh] flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-[#151921] shadow-2xl sm:min-h-0">
        <div className="flex flex-col gap-1 border-b border-slate-800 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 sm:text-sm">
            Registros detalhados
          </h3>
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">
            {registrosFiltrados.length} registro(s)
          </span>
        </div>
        <div className="h-full overflow-auto pb-12 sm:pb-14">
          <table className="w-full min-w-[1750px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#10141B]">
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 sm:text-[11px]">
                <th className="px-3 py-3 sm:px-4 sm:py-4">Data</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Matrícula</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Colaborador</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Turno</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Máquina</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Setor</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Tipo apontamento</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">OP</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Desenho</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Potência</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Linha</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">AT/BT</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4 text-right">Qtde apontada</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4 text-right">Qtde produzida</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4 text-right">Saldo</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4 text-right">Tempo produzido</th>
                <th className="px-3 py-3 sm:px-4 sm:py-4">Obs</th>
                <th className="sticky right-0 bg-[#10141B] px-3 py-3 sm:px-4 sm:py-4 text-center">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={18}
                    className="px-5 py-10 text-center text-sm font-bold text-slate-500"
                  >
                    Carregando registros...
                  </td>
                </tr>
              ) : registrosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={18}
                    className="px-5 py-10 text-center text-sm font-bold text-slate-500"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map((a) => {
                  const funcionario = funcionariosPorMatricula.get(a.matricula);
                  return (
                    <tr
                      key={
                        a.$id || `${a.data_apontamento}-${a.matricula}-${a.op}`
                      }
                      className="whitespace-nowrap text-xs font-semibold text-slate-300 transition hover:bg-slate-800/40 sm:text-sm"
                    >
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono text-slate-400">
                        {formatarData(a.data_apontamento)}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono text-white">
                        {a.matricula}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 text-white">
                        {a.nome_operador || funcionario?.nome || "-"}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4">
                        {a.turno || funcionario?.turno || "-"}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono">
                        {a.maquina || "-"}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4">{getSetor(a)}</td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4">
                        <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-black text-slate-300">
                          {getTipoApontamento(a)}
                        </span>
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono">{a.op || "-"}</td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono">{getDesenho(a)}</td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono">{getPotencia(a)}</td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4">{getLinha(a)}</td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 font-mono">
                        {getTipoEnrolamento(a)}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 text-right font-mono text-white">
                        {getQuantidadeFisicaApontadaBobinagem(a)}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 text-right font-mono text-white">
                        {getQuantidadeContabilizadaBobinagem(a)}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 text-right font-mono text-amber-300">
                        {getSaldoPendenteBobinagem(a)}
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 text-right font-mono text-white">
                        {calcularTempoProduzido(a).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{" "}
                        min
                      </td>
                      <td
                        className="max-w-[260px] truncate px-3 py-3 sm:px-4 sm:py-4"
                        title={limparMarcadoresSaldoBobinagem(a.obs) || "-"}
                      >
                        {limparMarcadoresSaldoBobinagem(a.obs) || "-"}
                      </td>
                      <td className="sticky right-0 bg-[#151921] px-3 py-3 sm:px-4 sm:py-4 text-center shadow-[-12px_0_18px_rgba(0,0,0,0.25)]">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => abrirEdicao(a)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 sm:gap-2 sm:px-3 sm:text-xs"
                            title="Editar registro"
                          >
                            <Edit3 className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirRegistro(a)}
                            disabled={excluindoId === a.$id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[11px] font-black uppercase tracking-widest text-rose-300 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-xs"
                            title="Excluir registro"
                          >
                            <Trash2 className="h-4 w-4" />
                            {excluindoId === a.$id ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {registroEditando && formEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-[#151921] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-3 py-3 sm:items-center sm:px-5 sm:py-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white sm:text-sm">
                  Editar registro
                </h3>
                <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">
                  Altere os dados do apontamento e salve diretamente no
                  Appwrite.
                </p>
              </div>
              <button
                type="button"
                onClick={fecharEdicao}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:border-rose-500 hover:text-rose-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(94vh-136px)] overflow-auto p-3 sm:p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FiltroInput label="Data">
                  <input
                    type="date"
                    value={formEdicao.data_apontamento}
                    onChange={(e) =>
                      atualizarCampoEdicao("data_apontamento", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Matrícula">
                  <input
                    value={formEdicao.matricula}
                    onChange={(e) =>
                      atualizarCampoEdicao("matricula", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Nome colaborador">
                  <input
                    value={formEdicao.nome_operador}
                    onChange={(e) =>
                      atualizarCampoEdicao("nome_operador", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Turno">
                  <input
                    value={formEdicao.turno}
                    onChange={(e) =>
                      atualizarCampoEdicao("turno", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Máquina">
                  <input
                    value={formEdicao.maquina}
                    onChange={(e) =>
                      atualizarCampoEdicao("maquina", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Setor máquina">
                  <input
                    value={formEdicao.setor_maquina}
                    onChange={(e) =>
                      atualizarCampoEdicao("setor_maquina", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Tipo apontamento">
                  <select
                    value={formEdicao.tipo_apontamento}
                    onChange={(e) =>
                      atualizarCampoEdicao("tipo_apontamento", e.target.value)
                    }
                    className={campoFiltro}
                  >
                    <option value="PRODUCAO">Produção com OP</option>
                    <option value="REFORMA">Reforma sem OP</option>
                  </select>
                </FiltroInput>
                <FiltroInput label="Tipo enrolamento">
                  <select
                    value={formEdicao.tipo_enrolamento}
                    onChange={(e) =>
                      atualizarCampoEdicao("tipo_enrolamento", e.target.value)
                    }
                    className={campoFiltro}
                  >
                    <option value="">Automático pela máquina</option>
                    <option value="AT">Enrolamento AT</option>
                    <option value="BT">Enrolamento BT</option>
                  </select>
                </FiltroInput>
                <FiltroInput label="OP">
                  <input
                    value={formEdicao.op}
                    onChange={(e) => atualizarCampoEdicao("op", e.target.value)}
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Desenho">
                  <input
                    value={formEdicao.desenho}
                    onChange={(e) =>
                      atualizarCampoEdicao("desenho", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Desenho manual">
                  <input
                    value={formEdicao.desenho_manual}
                    onChange={(e) =>
                      atualizarCampoEdicao("desenho_manual", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Potência">
                  <input
                    value={formEdicao.potencia}
                    onChange={(e) =>
                      atualizarCampoEdicao("potencia", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Potência manual">
                  <input
                    value={formEdicao.potencia_manual}
                    onChange={(e) =>
                      atualizarCampoEdicao("potencia_manual", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="OP">
              <input
                value={opFiltro}
                onChange={(e) => setOpFiltro(e.target.value)}
                placeholder="Buscar OP"
                className={campoFiltro}
              />
            </FiltroInput>
            <FiltroInput label="Linha">
                  <input
                    value={formEdicao.linha}
                    onChange={(e) =>
                      atualizarCampoEdicao("linha", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Linha manual">
                  <input
                    value={formEdicao.linha_manual}
                    onChange={(e) =>
                      atualizarCampoEdicao("linha_manual", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Qtde produzida">
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.qtd_produzida}
                    onChange={(e) =>
                      atualizarCampoEdicao("qtd_produzida", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Qtde apontada">
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.qtd_apontada}
                    onChange={(e) =>
                      atualizarCampoEdicao("qtd_apontada", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Qtde saldo">
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.qtd_saldo}
                    onChange={(e) =>
                      atualizarCampoEdicao("qtd_saldo", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
                <FiltroInput label="Observação">
                  <input
                    value={formEdicao.obs}
                    onChange={(e) =>
                      atualizarCampoEdicao("obs", e.target.value)
                    }
                    className={campoFiltro}
                  />
                </FiltroInput>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={fecharEdicao}
                className="w-full rounded-xl border border-slate-700 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-300 transition hover:border-slate-500 hover:text-white sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={salvandoEdicao}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-[#0A0B10] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <Save className="h-4 w-4" />
                {salvandoEdicao ? "Salvando..." : "Salvar edição"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
