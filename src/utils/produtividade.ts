import type { Apontamento } from '@/types';
import { getQuantidadeFisicaApontadaBobinagem } from '@/utils/quantidadeBobinagem';

export type TipoEnrolamento = 'AT' | 'BT';

export interface TempoPadrao {
  potencia: string;
  linha: string;
  at: number;
  bt: number;
}

export const MINUTOS_DISPONIVEIS_POR_COLABORADOR = 424;

export const TEMPOS_PADRAO: TempoPadrao[] = [
  { potencia: '5', linha: 'MON', at: 12, bt: 9.6 },
  { potencia: '10', linha: 'MON', at: 13.8, bt: 9.6 },
  { potencia: '15', linha: 'MON', at: 15, bt: 14.7 },
  { potencia: '25', linha: 'MON', at: 16.8, bt: 15 },
  { potencia: '37.5', linha: 'MON', at: 27.6, bt: 15.36 },
  { potencia: '15', linha: 'TRI', at: 42, bt: 15 },
  { potencia: '30', linha: 'TRI', at: 24, bt: 11.4 },
  { potencia: '45', linha: 'TRI', at: 25.2, bt: 15 },
  { potencia: '75', linha: 'TRI', at: 31.8, bt: 15.6 },
  { potencia: '112.5', linha: 'TRI', at: 27, bt: 23.4 },
  { potencia: '150', linha: 'TRI', at: 24, bt: 17 },
  { potencia: '225', linha: 'TRI', at: 60, bt: 28.2 },
  { potencia: '300', linha: 'TRI', at: 60, bt: 30 },
];

const normalizarPotencia = (valor?: string | number | null) => {
  if (valor === undefined || valor === null) return '';
  return String(valor)
    .toUpperCase()
    .replace('KVA', '')
    .replace(',', '.')
    .trim();
};

const normalizarLinha = (valor?: string | null) => String(valor || '').toUpperCase().trim();
const normalizarTipo = (valor?: string | null) => String(valor || '').toUpperCase().trim() as TipoEnrolamento;

export const derivarTipoEnrolamentoPorMaquina = (codigoMaquina?: string | null): TipoEnrolamento | '' => {
  const codigo = String(codigoMaquina || '').toUpperCase().replace(/\s+/g, '');
  if (codigo.includes('BOBAT')) return 'AT';
  if (codigo.includes('BOBBT')) return 'BT';
  return '';
};

export const descreverTipoEnrolamento = (tipo?: string | null) => {
  const tipoNormalizado = normalizarTipo(tipo);
  if (tipoNormalizado === 'AT') return 'AT - Alta tensão';
  if (tipoNormalizado === 'BT') return 'BT - Baixa tensão';
  return '-';
};

export const getDadosTecnicosApontamento = (apontamento: Apontamento) => {
  const isReforma = apontamento.tipo_apontamento === 'REFORMA';
  return {
    potencia: normalizarPotencia(isReforma ? apontamento.potencia_manual || apontamento.potencia : apontamento.potencia),
    linha: normalizarLinha(isReforma ? apontamento.linha_manual || apontamento.linha : apontamento.linha),
    tipoEnrolamento: normalizarTipo(apontamento.tipo_enrolamento) || derivarTipoEnrolamentoPorMaquina(apontamento.maquina),
  };
};

export const buscarTempoPadrao = (potencia?: string | number | null, linha?: string | null, tipo?: string | null) => {
  const potenciaNormalizada = normalizarPotencia(potencia);
  const linhaNormalizada = normalizarLinha(linha);
  const tipoNormalizado = normalizarTipo(tipo);

  const linhaBusca = linhaNormalizada === 'BIF' ? 'MON' : linhaNormalizada;
  const tempo = TEMPOS_PADRAO.find(
    (item) => item.potencia === potenciaNormalizada && item.linha === linhaBusca
  );

  if (!tempo) return null;
  if (tipoNormalizado === 'AT') return tempo.at;
  if (tipoNormalizado === 'BT') return tempo.bt;
  return null;
};

export const calcularTempoProduzidoPorQuantidade = (
  apontamento: Pick<Apontamento, 'tipo_apontamento' | 'potencia' | 'potencia_manual' | 'linha' | 'linha_manual' | 'tipo_enrolamento' | 'maquina'>,
  quantidadeApontada: number,
) => {
  const dados = getDadosTecnicosApontamento(apontamento as Apontamento);
  const minutosPorUnidade = buscarTempoPadrao(dados.potencia, dados.linha, dados.tipoEnrolamento);
  if (minutosPorUnidade === null) return 0;
  return quantidadeApontada * minutosPorUnidade;
};

export const calcularTempoProduzido = (apontamento: Apontamento) => {
  return calcularTempoProduzidoPorQuantidade(
    apontamento,
    getQuantidadeFisicaApontadaBobinagem(apontamento),
  );
};

export const formatarNumero = (valor: number, casas = 1) => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
};

export const formatarPercentual = (valor: number) => `${formatarNumero(valor, 1)}%`;
