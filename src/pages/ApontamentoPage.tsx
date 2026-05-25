import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { InfoCard, InfoRow, InfoAlert } from "@/components/InfoCard";
import { FormInput } from "@/components/FormInput";
import { FormSelect } from "@/components/FormSelect";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { buscarFuncionarioPorMatricula } from "@/services/funcionariosService";
import { listarMaquinas } from "@/services/maquinasService";
import { buscarOP, listarOps } from "@/services/opsService";
import { criarApontamentoComRegraBobinagem } from "@/services/apontamentosService";
import { cn } from "@/lib/utils";
import { derivarTipoEnrolamentoPorMaquina } from "@/utils/produtividade";
import { calcularQuantidadeContabilizadaBobinagem, linhaUsaConversaoBobinagem, getQuantidadeContabilizadaBobinagem } from "@/utils/quantidadeBobinagem";

import type { Funcionario, Maquina, OP, TipoApontamento } from "@/types";

const getHojeInputDate = () => new Date().toISOString().slice(0, 10);

const converterDataInputParaDateTime = (data: string) => {
  // Salva ao meio-dia UTC para preservar a data escolhida, evitando mudança de dia por fuso horário.
  return `${data}T12:00:00.000Z`;
};

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

  const isReforma = tipoApontamento === "REFORMA";
  const desenhoReformaValido = desenhoManual.trim().length > 0;
  const tipoEnrolamentoDerivado = derivarTipoEnrolamentoPorMaquina(maquinaCodigo);
  const dadosReformaValidos = desenhoReformaValido && potenciaManual.trim() && linhaManual.trim();
  const podeSalvar = Boolean(dataApontamento && funcionario && maquina && tipoEnrolamentoDerivado && (isReforma ? dadosReformaValidos : opData));

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setGlobalError("");

    if (!funcionario) {
      setGlobalError("Funcionário é obrigatório e deve estar válido.");
      return;
    }
    if (!maquina) {
      setGlobalError("Máquina selecionada inválida.");
      return;
    }
    if (!dataApontamento) {
      setGlobalError("Data do apontamento é obrigatória.");
      return;
    }
    if (!isReforma && !opData) {
      setGlobalError("OP é obrigatória e deve estar válida para apontamento de produção.");
      return;
    }
    if (!tipoEnrolamentoDerivado) {
      setGlobalError("Não foi possível identificar o tipo de enrolamento pelo código da máquina. Use máquina com código BOBAT para Alta Tensão ou BOBBT para Baixa Tensão.");
      return;
    }
    if (isReforma && !desenhoReformaValido) {
      setGlobalError("Desenho é obrigatório para apontamento de reforma.");
      return;
    }
    if (isReforma && (!potenciaManual.trim() || !linhaManual.trim())) {
      setGlobalError("Potência e fase/linha são obrigatórias para apontamento de reforma.");
      return;
    }
    const numQtd = Number(qtd.replace(',', '.'));
    if (isNaN(numQtd) || numQtd <= 0) {
      setGlobalError("Quantidade produzida deve ser maior que zero.");
      return;
    }

    const linhaParaConversao = isReforma ? linhaManual.trim().toUpperCase() : opData?.linha;
    if (!isReforma && linhaUsaConversaoBobinagem(linhaParaConversao) && !Number.isInteger(numQtd)) {
      setGlobalError(`Para linha ${String(linhaParaConversao || '').toUpperCase()}, informe uma quantidade inteira. A regra de bobinagem usa peças inteiras para formar a unidade produzida.`);
      return;
    }

    const desenhoReforma = desenhoManual.trim().toUpperCase();
    const potenciaReforma = potenciaManual.trim().replace(',', '.').toUpperCase();
    const linhaReforma = linhaManual.trim().toUpperCase();

    setSaving(true);
    try {
      const apontamentoSalvo = await criarApontamentoComRegraBobinagem({
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
        linha: isReforma ? linhaReforma : opData!.linha,
        potencia: isReforma ? potenciaReforma : opData!.potencia,
        produto: isReforma ? "REFORMA" : opData!.produto,
        qtd_produzida: numQtd,
        obs: obs.trim(),
        excluido: false
      });
      if (!isReforma && linhaUsaConversaoBobinagem(opData!.linha)) {
        const conversao = calcularQuantidadeContabilizadaBobinagem(numQtd, opData!.linha);
        const mensagemSaldo = conversao.saldoPendente > 0
          ? ` Saldo pendente deste lançamento: ${conversao.saldoPendente} peça(s).`
          : "";
        setSuccessMsg(`Apontamento salvo com regra ${opData!.linha}: ${conversao.fator} peça(s) = 1 unidade. Quantidade contabilizada: ${getQuantidadeContabilizadaBobinagem(apontamentoSalvo)}.${mensagemSaldo}`);
      } else {
        setSuccessMsg(isReforma ? "Apontamento de reforma salvo com sucesso!" : "Apontamento salvo com sucesso!");
      }
      
      setOpInput("");
      setOpData(null);
      setDesenhoManual("");
      setDesenhoEncontrado(null);
      setPotenciaManual("");
      setLinhaManual("");
      setQtd("");
      setObs("");
      
      const input = document.getElementById(isReforma ? 'desenho-manual-input' : 'op-input');
      if (input) input.focus();

    } catch (err) {
      console.error(err);
      setGlobalError(err instanceof Error ? err.message : "Erro ao salvar apontamento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full overflow-hidden">
        {/* Left Column: Input Form (60%) */}
        <div className="flex-[3] flex flex-col gap-3 overflow-y-auto pr-1">
          <form onSubmit={handleSubmit} className="bg-[#151921] rounded-xl border border-slate-800 p-4 shadow-2xl flex-1 flex flex-col min-h-fit">
            <h2 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              NOVO APONTAMENTO DE PRODUÇÃO
            </h2>
            
            {successMsg && (
              <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                {successMsg}
              </div>
            )}

            {globalError && (
              <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                {globalError}
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-[#0A0B10] p-1.5">
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

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
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

              <div className="col-span-2 md:col-span-1">
                <FormInput
                  label="Data do Apontamento"
                  type="date"
                  value={dataApontamento}
                  onChange={(e) => setDataApontamento(e.target.value)}
                  required
                />
              </div>

              {!isReforma ? (
                <div className="col-span-2">
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
                  <div className="col-span-2 space-y-2">
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
                        <div className="grid gap-1 md:grid-cols-2">
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
                      { value: 'TRI', label: 'TRI' },
                    ]}
                    value={linhaManual}
                    onChange={(e) => setLinhaManual(e.target.value)}
                    required
                  />

                  <p className="col-span-2 text-xs font-bold text-amber-300">
                    Reforma: informe desenho, potência e fase.
                  </p>
                </>
              )}


              <div className="col-span-2 md:col-span-1">
                <FormInput
                  label="Quantidade Produzida"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={qtd}
                  onChange={(e) => setQtd(e.target.value)}
                  className="text-2xl font-mono text-emerald-400"
                  required
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <div className="space-y-2 w-full">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Observação Opcional
                  </label>
                  <textarea
                    rows={1}
                    className="w-full bg-[#0A0B10] border border-slate-700 rounded-lg py-3 px-3 text-base text-slate-300 outline-none resize-none focus:border-emerald-500 transition-colors"
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
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-[#0A0B10] font-black text-base py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {saving ? (
                "GRAVANDO..."
              ) : (
                isReforma ? "GRAVAR REFORMA" : "GRAVAR APONTAMENTO"
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Validation Cards (40%) */}
        <div className="flex-[2] flex flex-col gap-3 overflow-y-auto pr-1">
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
                  <p className="text-sm font-bold text-emerald-400">ATIVO</p>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <p className="text-sm text-slate-500 py-3 text-center w-full">Informe a matrícula para carregar</p>
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
                <p className="text-sm text-slate-500 py-3 text-center w-full">Selecione a máquina para carregar</p>
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
                <p className="text-sm text-slate-500 py-3 text-center w-full">Informe a OP para carregar</p>
              </div>
            )}
          </InfoCard>
        </div>
    </div>
  );
}
