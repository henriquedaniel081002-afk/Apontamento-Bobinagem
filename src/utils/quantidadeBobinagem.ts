import type { Apontamento } from '@/types';

const SALDO_TAG_REGEX = /\s*\[SISTEMA_SALDO_BOBINAGEM:fator=(\d+);saldo=([0-9]+(?:[.,][0-9]+)?)(?:;qtdContabilizada=([0-9]+))?(?:;qtdApontada=([0-9]+))?\]\s*/gi;

export const normalizarLinhaBobinagem = (linha?: string | null) =>
  String(linha || '').trim().toUpperCase();

export const obterFatorConversaoBobinagem = (linha?: string | null) => {
  const linhaNormalizada = normalizarLinhaBobinagem(linha);
  if (linhaNormalizada === 'MON' || linhaNormalizada === 'BIF') return 2;
  if (linhaNormalizada === 'TRI') return 3;
  return 1;
};

export const linhaUsaConversaoBobinagem = (linha?: string | null) =>
  obterFatorConversaoBobinagem(linha) > 1;

export const limparMarcadoresSaldoBobinagem = (obs?: string | null) =>
  String(obs || '').replace(SALDO_TAG_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();

export const extrairSaldoBobinagem = (obs?: string | null) => {
  const texto = String(obs || '');
  const regex = new RegExp(SALDO_TAG_REGEX.source, 'i');
  const match = texto.match(regex);
  if (!match) return null;

  const detalheRegex = /fator=(\d+);saldo=([0-9]+(?:[.,][0-9]+)?)(?:;qtdContabilizada=([0-9]+))?(?:;qtdApontada=([0-9]+))?/i;
  const detalhe = match[0].match(detalheRegex);
  if (!detalhe) return null;

  const fator = Number(detalhe[1]);
  const saldo = Number(String(detalhe[2]).replace(',', '.'));
  const qtdContabilizada = detalhe[3] === undefined ? null : Number(detalhe[3]);
  const qtdApontada = detalhe[4] === undefined ? null : Number(detalhe[4]);

  if (!Number.isFinite(fator) || !Number.isFinite(saldo) || fator <= 1 || saldo < 0) {
    return null;
  }

  return {
    fator,
    saldo,
    qtdContabilizada: Number.isFinite(qtdContabilizada) ? qtdContabilizada : null,
    qtdApontada: Number.isFinite(qtdApontada) ? qtdApontada : null,
  };
};

export const adicionarMarcadorSaldoBobinagem = (
  obs: string | undefined | null,
  fator: number,
  saldo: number,
  qtdContabilizada?: number,
  qtdApontada?: number,
) => {
  const obsLimpa = limparMarcadoresSaldoBobinagem(obs);
  const qtdTag = Number.isInteger(qtdContabilizada) ? `;qtdContabilizada=${qtdContabilizada}` : '';
  const qtdApontadaTag = Number.isInteger(qtdApontada) ? `;qtdApontada=${qtdApontada}` : '';
  const tag = `[SISTEMA_SALDO_BOBINAGEM:fator=${fator};saldo=${saldo}${qtdTag}${qtdApontadaTag}]`;
  return [obsLimpa, tag].filter(Boolean).join(' ').trim();
};

export const getQuantidadeContabilizadaBobinagem = (apontamento: Pick<Apontamento, 'qtd_produzida' | 'obs'>) => {
  const saldo = extrairSaldoBobinagem(apontamento.obs);
  if (saldo?.qtdContabilizada !== null && saldo?.qtdContabilizada !== undefined) {
    return saldo.qtdContabilizada;
  }
  return Number(apontamento.qtd_produzida) || 0;
};

export const getSaldoPendenteBobinagem = (apontamento: Pick<Apontamento, 'obs'>) => {
  const saldo = extrairSaldoBobinagem(apontamento.obs);
  return saldo?.saldo ?? 0;
};

export const getQuantidadeFisicaApontadaBobinagem = (
  apontamento: Pick<Apontamento, 'qtd_produzida' | 'obs' | 'linha' | 'linha_manual' | 'tipo_apontamento'>,
) => {
  const saldo = extrairSaldoBobinagem(apontamento.obs);
  if (saldo?.qtdApontada !== null && saldo?.qtdApontada !== undefined) {
    return saldo.qtdApontada;
  }

  const fator = obterFatorConversaoBobinagem(getLinhaApontamentoBobinagem(apontamento));
  const quantidadeContabilizada = getQuantidadeContabilizadaBobinagem(apontamento);

  if (apontamento.tipo_apontamento !== 'PRODUCAO' || fator <= 1) {
    return quantidadeContabilizada;
  }

  if (saldo) {
    return quantidadeContabilizada * fator + saldo.saldo;
  }

  return quantidadeContabilizada * fator;
};

export const getLinhaApontamentoBobinagem = (apontamento: Pick<Apontamento, 'linha' | 'linha_manual' | 'tipo_apontamento'>) => {
  const linha = apontamento.tipo_apontamento === 'REFORMA'
    ? apontamento.linha_manual || apontamento.linha
    : apontamento.linha;
  return normalizarLinhaBobinagem(linha);
};

export const calcularQuantidadeContabilizadaBobinagem = (quantidadeApontada: number, linha?: string | null) => {
  const fator = obterFatorConversaoBobinagem(linha);
  if (fator <= 1) {
    return {
      fator,
      quantidadeContabilizada: quantidadeApontada,
      saldoPendente: 0,
    };
  }

  return {
    fator,
    quantidadeContabilizada: Math.floor(quantidadeApontada / fator),
    saldoPendente: quantidadeApontada % fator,
  };
};
