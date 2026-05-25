export interface BaseDocument {
  $id?: string;
}

export interface Funcionario extends BaseDocument {
  matricula: string;
  nome: string;
  setor: string;
  data_admissao?: string;
  turno: string;
  ativo: boolean;
}

export interface Maquina extends BaseDocument {
  codigo_maquina: string;
  setor: string;
  ativa: boolean;
}

export interface OP extends BaseDocument {
  op: string;
  potencia: string;
  linha: string;
  desenho: string;
  produto: string;
  qtd_produzir: number;
  ativa: boolean;
}

export type TipoApontamento = 'PRODUCAO' | 'REFORMA';

export interface Apontamento extends BaseDocument {
  data_apontamento: string;
  tipo_apontamento: TipoApontamento;
  matricula: string;
  nome_operador: string;
  setor_operador: string;
  turno: string;
  maquina: string;
  setor_maquina: string;
  op: string;
  desenho: string;
  desenho_manual?: string;
  potencia_manual?: string;
  linha_manual?: string;
  tipo_enrolamento?: string;
  linha: string;
  potencia: string;
  produto: string;
  qtd_produzida: number;
  obs?: string;
  excluido: boolean;
}

export type SyncAction = 'created' | 'updated' | 'inactivated' | 'deleted' | 'unchanged' | 'error';

export interface SyncIssue {
  sheet: string;
  row?: number;
  message: string;
}

export interface SyncSummaryItem {
  collection: 'funcionarios' | 'maquinas' | 'ops' | 'apontamentos';
  created: number;
  updated: number;
  inactivated: number;
  deleted: number;
  unchanged: number;
  errors: number;
}

export interface ExcelPreview {
  funcionarios: Funcionario[];
  maquinas: Maquina[];
  ops: OP[];
  issues: SyncIssue[];
}


export interface ApontamentosImportPreview {
  apontamentos: Omit<Apontamento, '$id'>[];
  issues: SyncIssue[];
}
