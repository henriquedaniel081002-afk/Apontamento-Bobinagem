import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { InfoCard, InfoRow, InfoAlert } from "@/components/InfoCard";
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { CheckCircle2, AlertCircle, PlusCircle, Trash2, PackageCheck } from "lucide-react";
import { buscarFuncionarioPorMatricula } from "@/services/funcionariosService";
import { listarMaquinas } from "@/services/maquinasService";
import { buscarOP, listarOps } from "@/services/opsService";
import { criarApontamentoComRegraBobinagem } from "@/services/apontamentosService";
import { cn } from "@/lib/utils";
import { calcularTempoProduzidoPorQuantidade, derivarTipoEnrolamentoPorMaquina, formatarNumero, formatarPercentual, MINUTOS_DISPONIVEIS_POR_COLABORADOR } from "@/utils/produtividade";
import { calcularQuantidadeContabilizadaBobinagem, linhaUsaConversaoBobinagem, getQuantidadeContabilizadaBobinagem } from "@/utils/quantidadeBobinagem";

import type { Apontamento, Funcionario, Maquina, OP, TipoApontamento } from "@/types";

const getHojeInputDate = () => new Date().toISOString().slice(0, 10);

const converterDataInputParaDateTime = (data: string) => {
  // Salva ao meio-dia UTC para preservar a data escolhida, evitando mudança de dia por fuso horário.
  return `${data}T12:00:00.000Z`;
};

type ApontamentoPayload = Omit<Apontamento, "$id">;

interface ItemLote {
  id: string;
  payload: ApontamentoPayload;
  quantidadeApontada: number;
  quantidadeContabilizada: number;
  tempoProduzido: number;
  descricao: string;
  linha: string;
  potencia: string;
  tipoEnrolamento: string;
}

interface ConfirmacaoProdutividade {
  titulo: string;
  operador: string;
  data: string;
  itens: number;
  tempoProduzido: number;
  tempoDisponivel: number;
  produtividade: number;
}

export function ApontamentoPage() {
  const [tipoApontamento, setTipoApontamento] = useState<TipoApontamento>("PRODUCAO");
  const [dataApontamento, setDataApontamento] = useState(getHojeInputDate());

  const [matricula, setMatricula] = useState("");
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [loadingFunc, setLoadingFunc] = useState(false);
  const [errorFunc, setErrorFunc] = useState("");

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinaCodigo, setMaquinaCodigo] = useState("");
  const [maquina, setMaquina] = useState<Maquina | null>(null);

  const [opInput, setOpInput] = useState("");
  const [opData, setOpData] = useState<OP | null>(null);
  const [loadingOp, setLoadingOp] = useState(false);
  const [errorOp, setErrorOp] = useState("");

  const [desenhoManual, setDesenhoManual] = useState("");
  const [opsBase, setOpsBase] = useState<OP[]>([]);
  const [desenhoEncontrado, setDesenhoEncontrado] = useState<OP | null>(null);
  const [potenciaManual, setPotenciaManual] = useState("");
  const [linhaManual, setLinhaManual] = useState("");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [modoLote, setModoLote] = useState(false);
  const [itensLote, setItensLote] = useState<ItemLote[]>([]);
  const [confirmacaoProdutividade, setConfirmacaoProdutividade] = useState<ConfirmacaoProdutividade | null>(null);

  const isReforma = tipoApontamento === "REFORMA";
  const desenhoReformaValido = desenhoManual.trim().length > 0;
  const tipoEnrolamentoDerivado = derivarTipoEnrolamentoPorMaquina(maquinaCodigo);
  const dadosReformaValidos = desenhoReformaValido && potenciaManual.trim() && linhaManual.trim();
  const podeSalvar = Boolean(dataApontamento && funcionario && maquina && tipoEnrolamentoDerivado && (isReforma ? dadosReformaValidos : opData));
  const tempoTotalLote = itensLote.reduce((total, item) => total + item.tempoProduzido, 0);
  const montarConfirmacaoProdutividade = (titulo: string, itens: number, tempoProduzido: number): ConfirmacaoProdutividade | null => {
    if (!funcionario) return null;
    return {
      titulo,
      operador: funcionario.nome,
      data: dataApontamento,
      itens,
      tempoProduzido,
      tempoDisponivel: MINUTOS_DISPONIVEIS_POR_COLABORADOR,
      produtividade: (tempoProduzido / MINUTOS_DISPONIVEIS_POR_COLABORADOR) * 100,
    };
  };

  useEffect(() => {
    listarMaquinas()
      .then(setMaquinas)
      .catch((err) => {
        console.error(err);
        setGlobalError(err instanceof Error ? err.message : 'Erro ao carregar máquinas.');
      });

    listarOps()
      .then((ops) => setOpsBase(ops.filter((op) => op.ativa)))
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const handleChangeTipoApontamento = (tipo: TipoApontamento) => {
    setTipoApontamento(tipo);
    setSuccessMsg("");
    setGlobalError("");
    setErrorOp("");
    setConfirmacaoProdutividade(null);

    if (tipo === "REFORMA") {
      setOpInput("");
      setOpData(null);
      setDesenhoEncontrado(null);
      window.setTimeout(() => document.getElementById('desenho-manual-input')?.focus(), 0);
    } else {
      setDesenhoManual("");
      setDesenhoEncontrado(null);
      setPotenciaManual("");
      setLinhaManual("");
      window.setTimeout(() => document.getElementById('op-input')?.focus(), 0);
    }
  };

  const handleBlurMatricula = async () => {
    const val = matricula.trim();
    if (!val) {
      setFuncionario(null);
      setErrorFunc("");
      return;
    }
    setLoadingFunc(true);
    setErrorFunc("");
    setSuccessMsg("");
    setGlobalError("");
    
    let func: Funcionario | null = null;
    try {
      func = await buscarFuncionarioPorMatricula(val);
    } catch (err) {
      setLoadingFunc(false);
      setFuncionario(null);
      setErrorFunc(err instanceof Error ? err.message : 'Erro ao buscar funcionário.');
      return;
    }
    setLoadingFunc(false);
    
    if (!func) {
      setFuncionario(null);
      setErrorFunc("Funcionário não encontrado.");
    } else if (!func.ativo) {
      setFuncionario(null);
      setErrorFunc("Funcionário inativo. Apontamento bloqueado.");
    } else {
      setFuncionario(func);
    }
  };

  const handleSelectMaquina = (e: ChangeEvent<HTMLSelectElement>) => {
    const cod = e.target.value;
    setMaquinaCodigo(cod);
    setSuccessMsg("");
    setGlobalError("");
    
    const maq = maquinas.find((m) => m.codigo_maquina === cod);
    setMaquina(maq || null);
  };

  const sugestoesDesenhoReforma = opsBase
    .filter((op) => op.desenho && op.desenho.toUpperCase().includes(desenhoManual.trim().toUpperCase()))
    .reduce<OP[]>((acc, op) => {
      if (!acc.some((item) => item.desenho === op.desenho)) acc.push(op);
      return acc;
    }, [])
    .slice(0, 12);

  const aplicarDadosDesenhoReforma = (valor: string) => {
    const desenho = valor.toUpperCase();
    setDesenhoManual(desenho);
    setSuccessMsg("");
    setGlobalError("");

    const encontrado = opsBase.find((op) => op.desenho?.toUpperCase() === desenho);
    setDesenhoEncontrado(encontrado || null);

    if (encontrado) {
      setPotenciaManual(String(encontrado.potencia || '').toUpperCase());
      setLinhaManual(String(encontrado.linha || '').toUpperCase());
    }
  };

  const handleBlurOp = async () => {
    if (isReforma) return;

    const val = opInput.trim();
    if (!val) {
      setOpData(null);
      setErrorOp("");
      return;
    }
    setLoadingOp(true);
    setErrorOp("");
    setSuccessMsg("");
    setGlobalError("");
    
    let opDoc: OP | null = null;
    try {
      opDoc = await buscarOP(val);
    } catch (err) {
      setLoadingOp(false);
      setOpData(null);
      setErrorOp(err instanceof Error ? err.message : 'Erro ao buscar OP.');
      return;
    }
    setLoadingOp(false);
    
    if (!opDoc) {
      setOpData(null);
      setErrorOp("OP não encontrada.");
    } else if (!opDoc.ativa) {
      setOpData(null);
      setErrorOp("OP inativa. Importe a base atualizada ou valide a OP.");
    } else {
      setOpData(opDoc);
    }
  };

  const resetCamposApontamento = () => {
    setOpInput("");
    setOpData(null);
    setDesenhoManual("");
    setDesenhoEncontrado(null);
    setPotenciaManual("");
    setLinhaManual("");
    setQtd("");
    setObs("");

    const input = document.getElementById(isReforma ? 'desenho-manual-input' : 'op-input');
    if (input) window.setTimeout(() => input.focus(), 0);
  };

  const montarPayloadApontamento = (): { payload: ApontamentoPayload; quantidadeApontada: number; quantidadeContabilizada: number; tempoProduzido: number; descricao: string; linha: string; potencia: string; tipoEnrolamento: string } | null => {
    if (!funcionario) {
      setGlobalError("Funcionário é obrigatório e deve estar válido.");
      return null;
    }
    if (!maquina) {
      setGlobalError("Máquina selecionada inválida.");
      return null;
    }
    if (!dataApontamento) {
      setGlobalError("Data do apontamento é obrigatória.");
      return null;
    }
    if (!isReforma && !opData) {
      setGlobalError("OP é obrigatória e deve estar válida para apontamento de produção.");
      return null;
    }
    if (!tipoEnrolamentoDerivado) {
      setGlobalError("Não foi possível identificar o tipo de enrolamento pelo código da máquina. Use máquina com código BOBAT para Alta Tensão ou BOBBT para Baixa Tensão.");
      return null;
    }
    if (isReforma && !desenhoReformaValido) {
      setGlobalError("Desenho é obrigatório para apontamento de reforma.");
      return null;
    }
    if (isReforma && (!potenciaManual.trim() || !linhaManual.trim())) {
      setGlobalError("Potência e fase/linha são obrigatórias para apontamento de reforma.");
      return null;
    }
    const numQtd = Number(qtd.replace(',', '.'));
    if (isNaN(numQtd) || numQtd <= 0) {
      setGlobalError("Quantidade produzida deve ser maior que zero.");
      return null;
    }

    const linhaParaConversao = isReforma ? linhaManual.trim().toUpperCase() : opData?.linha;
    if (!isReforma && linhaUsaConversaoBobinagem(linhaParaConversao) && !Number.isInteger(numQtd)) {
      setGlobalError(`Para linha ${String(linhaParaConversao || '').toUpperCase()}, informe uma quantidade inteira. A regra de bobinagem usa peças inteiras para formar a unidade produzida.`);
      return null;
    }

    const desenhoReforma = desenhoManual.trim().toUpperCase();
    const potenciaReforma = potenciaManual.trim().replace(',', '.').toUpperCase();
    const linhaReforma = linhaManual.trim().toUpperCase();
    const linhaFinal = isReforma ? linhaReforma : opData!.linha;
    const potenciaFinal = isReforma ? potenciaReforma : opData!.potencia;
    const conversaoPreview = calcularQuantidadeContabilizadaBobinagem(numQtd, linhaFinal);

    const payload: ApontamentoPayload = {
      data_apontamento: converterDataInputParaDateTime(dataApontamento),
      tipo_apontamento: tipoApontamento,
      matricula: funcionario.matricula,
      nome_operador: funcionario.nome,
      setor_operador: funcionario.setor,
      turno: funcionario.turno,
      maquina: maquina.codigo_maquina,
      setor_maquina: maquina.setor,
      op: isReforma ? "SEM_OP_REFORMA" : opData!.op,
      desenho: isReforma ? desenhoReforma : opData!.desenho,
      desenho_manual: isReforma ? desenhoReforma : "",
      potencia_manual: isReforma ? potenciaReforma : "",
      linha_manual: isReforma ? linhaReforma : "",
      tipo_enrolamento: tipoEnrolamentoDerivado,
      linha: linhaFinal,
      potencia: potenciaFinal,
      produto: isReforma ? "REFORMA" : opData!.produto,
      qtd_produzida: numQtd,
      obs: obs.trim(),
      excluido: false
    };

    return {
      payload,
      quantidadeApontada: numQtd,
      quantidadeContabilizada: conversaoPreview.quantidadeContabilizada,
      tempoProduzido: calcularTempoProduzidoPorQuantidade(payload, numQtd),
      descricao: isReforma ? desenhoReforma : opData!.op,
      linha: linhaFinal,
      potencia: potenciaFinal,
      tipoEnrolamento: tipoEnrolamentoDerivado,
    };
  };

  const adicionarItemAoLote = () => {
    setSuccessMsg("");
    setGlobalError("");
    setConfirmacaoProdutividade(null);
    const item = montarPayloadApontamento();
    if (!item) return;

    setItensLote((atual) => [
      ...atual,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...item,
      },
    ]);
    setSuccessMsg("Item adicionado ao lote. Revise o resumo e confirme o lote quando finalizar.");
    resetCamposApontamento();
  };

  const removerItemLote = (id: string) => {
    setItensLote((atual) => atual.filter((item) => item.id !== id));
    setSuccessMsg("");
    setGlobalError("");
  };

  const confirmarLote = async () => {
    if (itensLote.length === 0) {
      setGlobalError("Adicione pelo menos um item ao lote antes de confirmar.");
      return;
    }

    setSaving(true);
    setSuccessMsg("");
    setGlobalError("");

    try {
      const itensGravados = itensLote.length;
      const tempoProduzidoGravado = tempoTotalLote;

      for (const item of itensLote) {
        await criarApontamentoComRegraBobinagem(item.payload);
      }

      setSuccessMsg(`Lote gravado com sucesso: ${itensGravados} item(ns).`);
      setConfirmacaoProdutividade(montarConfirmacaoProdutividade('Lote gravado com sucesso', itensGravados, tempoProduzidoGravado));
      setItensLote([]);
      resetCamposApontamento();
    } catch (err) {
      console.error(err);
      setGlobalError(err instanceof Error ? err.message : "Erro ao salvar lote. Verifique os itens e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (modoLote) {
      adicionarItemAoLote();
      return;
    }

    setSuccessMsg("");
    setGlobalError("");
    setConfirmacaoProdutividade(null);
    const item = montarPayloadApontamento();
    if (!item) return;

    setSaving(true);
    try {
      const apontamentoSalvo = await criarApontamentoComRegraBobinagem(item.payload);
      if (!isReforma && linhaUsaConversaoBobinagem(item.payload.linha)) {
        const conversao = calcularQuantidadeContabilizadaBobinagem(item.quantidadeApontada, item.payload.linha);
        const mensagemSaldo = conversao.saldoPendente > 0
          ? ` Saldo pendente deste lançamento: ${conversao.saldoPendente} peça(s).`
          : "";
        setSuccessMsg(`Apontamento salvo com regra ${item.payload.linha}: ${conversao.fator} peça(s) = 1 unidade. Quantidade contabilizada: ${getQuantidadeContabilizadaBobinagem(apontamentoSalvo)}.${mensagemSaldo}`);
      } else {
        setSuccessMsg(isReforma ? "Apontamento de reforma salvo com sucesso!" : "Apontamento salvo com sucesso!");
      }

      setConfirmacaoProdutividade(montarConfirmacaoProdutividade('Apontamento gravado com sucesso', 1, item.tempoProduzido));
      resetCamposApontamento();
    } catch (err) {
      console.error(err);
      setGlobalError(err instanceof Error ? err.message : "Erro ao salvar apontamento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-col gap-3 overflow-visible sm:h-full sm:overflow-hidden lg:flex-row lg:gap-4">
        {/* Left Column: Input Form (60%) */}
        <div className="flex min-h-0 flex-[3] flex-col gap-3 overflow-visible sm:overflow-y-auto sm:pr-1">
          <form onSubmit={handleSubmit} className="flex min-h-fit flex-1 flex-col rounded-xl border border-slate-800 bg-[#151921] p-3 shadow-2xl sm:p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400 sm:text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              NOVO APONTAMENTO DE PRODUÇÃO
            </h2>
            
            {successMsg && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-400 sm:items-center sm:gap-3 sm:text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {successMsg}
              </div>
            )}

            {globalError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-bold text-rose-400 sm:items-center sm:gap-3 sm:text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {globalError}
              </div>
            )}

            <div className="mb-3 rounded-xl border border-slate-800 bg-[#0A0B10] p-1.5 sm:mb-4">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModoLote(false);
                    setSuccessMsg("");
                    setGlobalError("");
                  }}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest transition",
                    !modoLote
                      ? "bg-emerald-500 text-[#0A0B10] shadow-lg shadow-emerald-500/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoLote(true);
                    setSuccessMsg("");
                    setGlobalError("");
                  }}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest transition",
                    modoLote
                      ? "bg-blue-400 text-[#0A0B10] shadow-lg shadow-blue-400/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  Apontamento por lote
                </button>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-[#0A0B10] p-1.5 sm:mb-4 sm:gap-2">
              <button
                type="button"
                onClick={() => handleChangeTipoApontamento("PRODUCAO")}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest transition",
                  !isReforma
                    ? "bg-emerald-500 text-[#0A0B10] shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                Produção com OP
              </button>
              <button
                type="button"
                onClick={() => handleChangeTipoApontamento("REFORMA")}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-xs font-black uppercase tracking-widest transition",
                  isReforma
                    ? "bg-amber-400 text-[#0A0B10] shadow-lg shadow-amber-400/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                Reforma
              </button>
            </div>

            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 sm:gap-x-4">
              <FormInput
                label="Matrícula do Operador"
                placeholder="Ex: 12345"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                onBlur={handleBlurMatricula}
                error={errorFunc}
                loading={loadingFunc}
                required
              />

              <FormSelect
                label="Código da Máquina"
                options={maquinas.map((m) => ({ value: m.codigo_maquina, label: m.codigo_maquina }))}
                value={maquinaCodigo}
                onChange={handleSelectMaquina}
                className={maquina && !maquina.ativa ? "border-amber-500/50" : ""}
                required
              />

              <div className="sm:col-span-1">
                <FormInput
                  label="Data do Apontamento"
                  type="date"
                  value={dataApontamento}
                  onChange={(e) => setDataApontamento(e.target.value)}
                  required
                />
              </div>

              {!isReforma ? (
                <div className="col-span-1 sm:col-span-2">
                  <FormInput
                    id="op-input"
                    label="Ordem de Produção (OP)"
                    placeholder="Ex: 987654"
                    value={opInput}
                    onChange={(e) => setOpInput(e.target.value.toUpperCase())}
                    onBlur={handleBlurOp}
                    error={errorOp}
                    loading={loadingOp}
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="col-span-1 space-y-2 sm:col-span-2">
                    <FormInput
                      id="desenho-manual-input"
                      label="Desenho da Reforma"
                      placeholder="Digite o desenho"
                      value={desenhoManual}
                      onChange={(e) => aplicarDadosDesenhoReforma(e.target.value)}
                      autoComplete="off"
                      required
                    />
                    {desenhoManual && sugestoesDesenhoReforma.length > 0 && !desenhoEncontrado && (
                      <div className="rounded-xl border border-slate-800 bg-[#0A0B10] p-2 shadow-xl">
                        <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Sugestões encontradas</p>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {sugestoesDesenhoReforma.map((op) => (
                            <button
                              key={`${op.$id || op.op}-${op.desenho}`}
                              type="button"
                              onClick={() => aplicarDadosDesenhoReforma(op.desenho)}
                              className="rounded-lg border border-slate-800 px-3 py-2 text-left text-xs font-bold text-slate-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-300"
                            >
                              <span className="block font-mono text-sm text-white">{op.desenho}</span>
                              <span className="text-slate-500">{op.linha || '-'} / {op.potencia || '-'} kVA</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {desenhoEncontrado && (
                      <p className="text-xs font-bold text-emerald-400">
                        Desenho localizado na base: linha e potência preenchidas automaticamente.
                      </p>
                    )}
                  </div>

                  <FormInput
                    label="Potência da Reforma"
                    placeholder="Ex: 15 ou 37,5"
                    value={potenciaManual}
                    onChange={(e) => setPotenciaManual(e.target.value.toUpperCase())}
                    required
                  />

                  <FormSelect
                    label="Fase / Linha"
                    options={[
                      { value: 'MON', label: 'MON' },
                      { value: 'BIF', label: 'BIF' },
                      { value: 'TRI', label: 'TRI' },
                    ]}
                    value={linhaManual}
                    onChange={(e) => setLinhaManual(e.target.value)}
                    required
                  />

                  <p className="col-span-1 text-xs font-bold text-amber-300 sm:col-span-2">
                    Reforma: informe desenho, potência e fase.
                  </p>
                </>
              )}


              <div className="sm:col-span-1">
                <FormInput
                  label="Quantidade Produzida"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={qtd}
                  onChange={(e) => setQtd(e.target.value)}
                  className="font-mono text-xl text-emerald-400 sm:text-2xl"
                  required
                />
              </div>

              <div className="sm:col-span-1">
                <div className="space-y-2 w-full">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Observação Opcional
                  </label>
                  <textarea
                    rows={1}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-[#0A0B10] px-3 py-2.5 text-base text-slate-300 outline-none transition-colors focus:border-emerald-500 sm:py-3"
                    placeholder={isReforma ? "Ex: Reforma de transformador" : "Ex: Troca de ferramenta"}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !podeSalvar}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-black uppercase tracking-widest text-[#0A0B10] shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:py-4 sm:text-base"
            >
              {saving ? (
                "GRAVANDO..."
              ) : modoLote ? (
                <><PlusCircle className="h-5 w-5" /> ADICIONAR AO LOTE</>
              ) : (
                isReforma ? "GRAVAR REFORMA" : "GRAVAR APONTAMENTO"
              )}
            </button>

            {modoLote && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 sm:p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-300 sm:text-sm">
                      <PackageCheck className="h-5 w-5" />
                      Resumo do lote
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Adicione todos os apontamentos do operador e confirme uma única vez.
                    </p>
                  </div>
                  {itensLote.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItensLote([])}
                      className="w-full rounded-lg border border-slate-700 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-300 hover:border-rose-400 hover:text-rose-300 sm:w-auto"
                    >
                      Limpar lote
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-800 bg-[#0A0B10] p-2.5 sm:p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Itens</p>
                    <p className="text-xl font-black text-white sm:text-2xl">{itensLote.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0A0B10] p-2.5 sm:p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tempo produzido</p>
                    <p className="text-xl font-black text-blue-300 sm:text-2xl">{formatarNumero(tempoTotalLote, 1)} min</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0A0B10] p-2.5 sm:p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tempo disponível</p>
                    <p className="text-xl font-black text-white sm:text-2xl">{MINUTOS_DISPONIVEIS_POR_COLABORADOR} min</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0A0B10] p-2.5 sm:p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Produtividade</p>
                    <p className="text-xs font-bold text-slate-400">Exibida após gravar lote</p>
                  </div>
                </div>

                {itensLote.length > 0 ? (
                  <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-[#0A0B10]">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="sticky top-0 bg-[#0A0B10] text-[10px] uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Item</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Linha</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Potência</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Tipo</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Qtde apontada</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Qtde contabilizada</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3">Tempo</th>
                          <th className="px-2.5 py-2.5 sm:px-3 sm:py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {itensLote.map((item) => (
                          <tr key={item.id} className="text-slate-300">
                            <td className="px-3 py-3 font-bold text-white">{item.descricao}</td>
                            <td className="px-2.5 py-2.5 sm:px-3 sm:py-3">{item.linha}</td>
                            <td className="px-2.5 py-2.5 sm:px-3 sm:py-3">{item.potencia}</td>
                            <td className="px-2.5 py-2.5 sm:px-3 sm:py-3">{item.tipoEnrolamento}</td>
                            <td className="px-2.5 py-2.5 sm:px-3 sm:py-3">{formatarNumero(item.quantidadeApontada, 0)}</td>
                            <td className="px-2.5 py-2.5 sm:px-3 sm:py-3">{formatarNumero(item.quantidadeContabilizada, 0)}</td>
                            <td className="px-3 py-3 text-blue-300">{formatarNumero(item.tempoProduzido, 1)} min</td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removerItemLote(item.id)}
                                className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-rose-400 hover:text-rose-300"
                                title="Remover item do lote"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-[#0A0B10] p-4 text-center text-sm font-bold text-slate-500">
                    Nenhum item adicionado ao lote.
                  </div>
                )}

                <button
                  type="button"
                  disabled={saving || itensLote.length === 0}
                  onClick={confirmarLote}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-400 px-4 py-3.5 text-xs font-black uppercase tracking-widest text-[#0A0B10] shadow-lg shadow-blue-400/20 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-3 sm:px-6 sm:py-4 sm:text-sm"
                >
                  <PackageCheck className="h-5 w-5" />
                  {saving ? 'Gravando lote...' : 'Gravar lote'}
                </button>
              </div>
            )}
          </form>
        </div>

        {confirmacaoProdutividade && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:px-4">
            <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#151921] p-4 shadow-2xl shadow-emerald-500/10 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3 sm:gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">Confirmação</p>
                  <h3 className="mt-1 text-lg font-black text-white sm:text-xl">{confirmacaoProdutividade.titulo}</h3>
                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">{confirmacaoProdutividade.operador} • {confirmacaoProdutividade.data}</p>
                </div>
                <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-400 sm:h-8 sm:w-8" />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-xl border border-slate-800 bg-[#0A0B10] p-3 sm:p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tempo produzido</p>
                  <p className="mt-1 text-xl font-black text-blue-300 sm:text-2xl">{formatarNumero(confirmacaoProdutividade.tempoProduzido, 1)} min</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0A0B10] p-3 sm:p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tempo disponível</p>
                  <p className="mt-1 text-xl font-black text-white sm:text-2xl">{confirmacaoProdutividade.tempoDisponivel} min</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0A0B10] p-3 sm:col-span-2 sm:p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Produtividade</p>
                  <p className="mt-1 text-3xl font-black text-emerald-400 sm:text-4xl">{formatarPercentual(confirmacaoProdutividade.produtividade)}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">Base de cálculo: tempo produzido ÷ tempo disponível do operador.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmacaoProdutividade(null)}
                className="mt-4 w-full rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-[#0A0B10] hover:bg-emerald-400 sm:mt-5 sm:text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        )}


        {/* Right Column: Validation Cards (40%) */}
        <div className="flex min-h-0 flex-[2] flex-col gap-3 overflow-visible sm:overflow-y-auto sm:pr-1">
          <InfoCard 
            title={funcionario ? "FUNCIONÁRIO IDENTIFICADO" : "OPERADOR"} 
            variant={funcionario ? "success" : "neutral"}
            className={!funcionario ? "opacity-50" : ""}
          >
            {funcionario ? (
              <>
                <InfoRow label="Nome Completo" value={funcionario.nome} highlight />
                <InfoRow label="Setor" value={funcionario.setor} />
                <InfoRow label="Turno" value={funcionario.turno} />
                <div className="col-span-1">
                  <p className="text-[10px] text-slate-500 uppercase">Status</p>
                  <p className="text-[13px] font-bold text-emerald-400 sm:text-sm">ATIVO</p>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <p className="w-full py-2 text-center text-xs text-slate-500 sm:py-3 sm:text-sm">Informe a matrícula para carregar</p>
              </div>
            )}
          </InfoCard>

          <InfoCard 
            title={maquina ? (!maquina.ativa ? "MÁQUINA (AVISO OPERAÇÃO)" : "MÁQUINA IDENTIFICADA") : "MÁQUINA"} 
            variant={maquina ? (!maquina.ativa ? "warning" : "success") : "neutral"}
            className={!maquina ? "opacity-50 flex-none" : "flex-none"}
          >
            {maquina ? (
              <>
                <InfoRow label="Identificação" value={maquina.codigo_maquina} highlight />
                <InfoRow label="Setor Máquina" value={maquina.setor} />
                {!maquina.ativa && (
                  <InfoAlert variant="warning">
                    Aviso: Esta máquina está marcada como INATIVA no sistema, mas o apontamento ainda é permitido por contingência.
                  </InfoAlert>
                )}
              </>
            ) : (
              <div className="col-span-2">
                <p className="w-full py-2 text-center text-xs text-slate-500 sm:py-3 sm:text-sm">Selecione a máquina para carregar</p>
              </div>
            )}
          </InfoCard>

          <InfoCard 
            title={isReforma ? "DADOS DA REFORMA" : "DADOS TÉCNICOS DA ORDEM"} 
            variant={opData || isReforma ? "neutral" : "neutral"}
            className={!opData && !isReforma ? "opacity-50" : ""}
          >
            {isReforma ? (
              <>
                <InfoRow label="Tipo" value="REFORMA" highlight />
                <InfoRow label="Data" value={dataApontamento || "Não informada"} />
                <InfoRow label="OP" value="Não obrigatória" />
                <InfoRow label="Desenho informado" value={desenhoManual.trim() || "Aguardando preenchimento"} colSpan={2} />
                <InfoRow label="Potência / Linha" value={`${potenciaManual || "-"} / ${linhaManual || "-"}`} />
                <InfoAlert variant="warning">
                  Este apontamento será salvo sem buscar OP. O desenho informado pelo operador será usado como referência técnica da reforma.
                </InfoAlert>
              </>
            ) : opData ? (
              <>
                <InfoRow label="Data" value={dataApontamento || "Não informada"} />
                <InfoRow label="Produto / Descrição" value={opData.produto} colSpan={2} />
                <InfoRow label="Desenho" value={opData.desenho} highlight />
                <InfoRow label="Linha / Potência" value={`${opData.linha} / ${opData.potencia}`} />
                <div className="col-span-2 pt-3 mt-1 border-t border-slate-800">
                  <div className="flex justify-between items-end mb-1">
                    <p className="text-[10px] text-slate-500 uppercase">Meta de Produção</p>
                    <p className="text-xs font-bold text-white">
                      {qtd && !isNaN(Number(qtd)) ? `${qtd} / ` : ""} {opData.qtd_produzir} pçs
                    </p>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${Math.min(100, Math.max(0, ((Number(qtd) || 0) / opData.qtd_produzir) * 100))}%` }}
                    ></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <p className="w-full py-2 text-center text-xs text-slate-500 sm:py-3 sm:text-sm">Informe a OP para carregar</p>
              </div>
            )}
          </InfoCard>
        </div>
    </div>
  );
}
