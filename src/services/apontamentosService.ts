import { databases, ID, DATABASE_ID, COLLECTIONS, Query } from "@/lib/appwrite";
import { deleteDocument as deleteAppwriteDocument, listAllDocuments } from "@/services/appwriteCrud";
import type { Apontamento } from "@/types";
import {
  adicionarMarcadorSaldoBobinagem,
  extrairSaldoBobinagem,
  getLinhaApontamentoBobinagem,
  limparMarcadoresSaldoBobinagem,
  obterFatorConversaoBobinagem,
  getQuantidadeContabilizadaBobinagem,
  getQuantidadeFisicaApontadaBobinagem,
} from "@/utils/quantidadeBobinagem";

export const criarApontamento = async (
  payload: Omit<Apontamento, "$id">,
): Promise<Apontamento> => {
  const response = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.apontamentos,
    ID.unique(),
    payload,
  );

  return response as unknown as Apontamento;
};


const normalizarOP = (valor?: string | null) => String(valor || '').trim().toUpperCase();

const ordenarPorDataCriacao = (a: Apontamento, b: Apontamento) => {
  const dataA = new Date(a.data_apontamento || '').getTime();
  const dataB = new Date(b.data_apontamento || '').getTime();
  return (Number.isFinite(dataA) ? dataA : 0) - (Number.isFinite(dataB) ? dataB : 0);
};

export const criarApontamentoComRegraBobinagem = async (
  payload: Omit<Apontamento, "$id">,
): Promise<Apontamento> => {
  const linha = getLinhaApontamentoBobinagem(payload);
  const fator = obterFatorConversaoBobinagem(linha);
  const quantidadeApontada = Number(payload.qtd_produzida) || 0;

  if (payload.tipo_apontamento !== 'PRODUCAO' || fator <= 1) {
    return criarApontamento({
      ...payload,
      obs: limparMarcadoresSaldoBobinagem(payload.obs),
    });
  }

  if (!Number.isInteger(quantidadeApontada)) {
    throw new Error(`Para linha ${linha}, informe uma quantidade inteira. A conversão usa ${fator} peça(s) apontada(s) para formar 1 unidade produzida.`);
  }

  let restanteApontado = quantidadeApontada;
  const opAtual = normalizarOP(payload.op);
  const registros = await listarApontamentos();
  const pendentes = registros
    .filter((registro) => {
      if (!registro.$id) return false;
      if (registro.tipo_apontamento !== 'PRODUCAO') return false;
      if (normalizarOP(registro.op) !== opAtual) return false;
      if (getLinhaApontamentoBobinagem(registro) !== linha) return false;
      const saldo = extrairSaldoBobinagem(registro.obs);
      return Boolean(saldo && saldo.fator === fator && saldo.saldo > 0);
    })
    .sort(ordenarPorDataCriacao);

  for (const pendente of pendentes) {
    if (!pendente.$id || restanteApontado <= 0) break;

    const saldoAtual = extrairSaldoBobinagem(pendente.obs);
    if (!saldoAtual) continue;

    const necessarioParaFechar = fator - saldoAtual.saldo;
    const usadoParaCompletar = Math.min(restanteApontado, necessarioParaFechar);
    const saldoAtualizado = saldoAtual.saldo + usadoParaCompletar;
    const fechouUnidade = saldoAtualizado >= fator;

    const quantidadeContabilizadaPendente = getQuantidadeContabilizadaBobinagem(pendente);
    const quantidadeApontadaOriginalPendente = getQuantidadeFisicaApontadaBobinagem(pendente);
    const novaQuantidadeContabilizadaPendente = quantidadeContabilizadaPendente + (fechouUnidade ? 1 : 0);

    await atualizarApontamento(pendente.$id, {
      qtd_produzida: Math.max(1, novaQuantidadeContabilizadaPendente),
      obs: adicionarMarcadorSaldoBobinagem(
        pendente.obs,
        fator,
        fechouUnidade ? 0 : saldoAtualizado,
        novaQuantidadeContabilizadaPendente,
        quantidadeApontadaOriginalPendente,
      ),
    });

    restanteApontado -= usadoParaCompletar;
  }


  const quantidadeContabilizada = Math.floor(restanteApontado / fator);
  const saldoPendente = restanteApontado % fator;
  const quantidadeParaSalvar = Math.max(1, quantidadeContabilizada);

  return criarApontamento({
    ...payload,
    qtd_produzida: quantidadeParaSalvar,
    obs: adicionarMarcadorSaldoBobinagem(
      payload.obs,
      fator,
      saldoPendente,
      quantidadeContabilizada,
      quantidadeApontada,
    ),
  });
};

export const atualizarApontamento = async (
  documentId: string,
  payload: Partial<Omit<Apontamento, "$id">>,
): Promise<Apontamento> => {
  const response = await databases.updateDocument(
    DATABASE_ID,
    COLLECTIONS.apontamentos,
    documentId,
    payload,
  );

  return response as unknown as Apontamento;
};

export const excluirApontamento = async (
  documentId: string,
): Promise<boolean> => {
  await deleteAppwriteDocument(COLLECTIONS.apontamentos, documentId);

  return true;
};

export const excluirTodosApontamentos = async (): Promise<number> => {
  const registros = await listAllDocuments<Apontamento>(
    COLLECTIONS.apontamentos,
  );

  for (const registro of registros) {
    if (registro.$id) {
      await deleteAppwriteDocument(COLLECTIONS.apontamentos, registro.$id);
    }
  }

  return registros.length;
};

export const listarApontamentos = async (): Promise<Apontamento[]> => {
  const todos: Apontamento[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.apontamentos,
      [
        Query.equal("excluido", false),
        Query.limit(limit),
        Query.offset(offset),
        Query.orderDesc("data_apontamento"),
      ],
    );

    todos.push(...(response.documents as unknown as Apontamento[]));
    if (response.documents.length < limit) break;
    offset += limit;
  }

  return todos;
};
