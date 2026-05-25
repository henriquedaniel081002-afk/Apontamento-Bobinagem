import * as XLSX from 'xlsx';
import type { ExcelPreview, Funcionario, Maquina, OP, SyncIssue, SyncSummaryItem } from '@/types';
import { COLLECTIONS } from '@/lib/appwrite';
import { createDocument, deleteDocument, listAllDocuments, updateDocument } from '@/services/appwriteCrud';
import { normalizeBoolean, normalizeDate, normalizeHeader, normalizeKey, normalizeNumber, normalizeText } from './normalizers';

type SheetName = 'funcionarios' | 'maquinas' | 'ops';

type Row = Record<string, unknown>;

const REQUIRED_COLUMNS: Record<SheetName, string[]> = {
  funcionarios: ['matricula', 'nome', 'setor', 'turno'],
  maquinas: ['codigo_maquina', 'setor'],
  ops: ['op', 'potencia', 'linha', 'desenho', 'produto', 'qtd_produzir'],
};

function getSheet(workbook: XLSX.WorkBook, expectedName: SheetName): XLSX.WorkSheet | null {
  const foundName = workbook.SheetNames.find((name) => normalizeHeader(name) === expectedName);
  return foundName ? workbook.Sheets[foundName] : null;
}

function normalizeRows(sheet: XLSX.WorkSheet): Row[] {
  const rawRows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false });

  return rawRows.map((row) => {
    const normalized: Row = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeHeader(key)] = value;
    });
    return normalized;
  });
}

function validateColumns(sheetName: SheetName, rows: Row[], issues: SyncIssue[]) {
  const available = new Set(Object.keys(rows[0] ?? {}));
  const missing = REQUIRED_COLUMNS[sheetName].filter((col) => !available.has(col));

  missing.forEach((col) => {
    issues.push({
      sheet: sheetName,
      message: `Coluna obrigatória não encontrada: ${col}`,
    });
  });
}

function parseFuncionarios(rows: Row[], issues: SyncIssue[]): Funcionario[] {
  const items: Funcionario[] = [];
  const keys = new Set<string>();

  rows.forEach((row, index) => {
    const matricula = normalizeKey(row.matricula);
    if (!matricula) {
      issues.push({ sheet: 'funcionarios', row: index + 2, message: 'Matrícula vazia.' });
      return;
    }
    if (keys.has(matricula)) {
      issues.push({ sheet: 'funcionarios', row: index + 2, message: `Matrícula duplicada no Excel: ${matricula}` });
      return;
    }

    keys.add(matricula);
    items.push({
      matricula,
      nome: normalizeText(row.nome),
      setor: normalizeText(row.setor),
      data_admissao: normalizeDate(row.data_admissao) || undefined,
      turno: normalizeText(row.turno),
      ativo: normalizeBoolean(row.ativo, true),
    });
  });

  return items;
}

function parseMaquinas(rows: Row[], issues: SyncIssue[]): Maquina[] {
  const items: Maquina[] = [];
  const keys = new Set<string>();

  rows.forEach((row, index) => {
    const codigo = normalizeKey(row.codigo_maquina);
    if (!codigo) {
      issues.push({ sheet: 'maquinas', row: index + 2, message: 'Código da máquina vazio.' });
      return;
    }
    if (keys.has(codigo)) {
      issues.push({ sheet: 'maquinas', row: index + 2, message: `Máquina duplicada no Excel: ${codigo}` });
      return;
    }

    keys.add(codigo);
    items.push({
      codigo_maquina: codigo,
      setor: normalizeText(row.setor),
      ativa: normalizeBoolean(row.ativa, true),
    });
  });

  return items;
}

function parseOps(rows: Row[], issues: SyncIssue[]): OP[] {
  const items: OP[] = [];
  const keys = new Set<string>();

  rows.forEach((row, index) => {
    const op = normalizeKey(row.op);
    if (!op) {
      issues.push({ sheet: 'ops', row: index + 2, message: 'OP vazia.' });
      return;
    }
    if (keys.has(op)) {
      issues.push({ sheet: 'ops', row: index + 2, message: `OP duplicada no Excel: ${op}` });
      return;
    }

    keys.add(op);
    items.push({
      op,
      potencia: normalizeText(row.potencia),
      linha: normalizeText(row.linha),
      desenho: normalizeText(row.desenho),
      produto: normalizeText(row.produto),
      qtd_produzir: normalizeNumber(row.qtd_produzir),
      ativa: normalizeBoolean(row.ativa, true),
    });
  });

  return items;
}

export async function parseExcelFile(file: File): Promise<ExcelPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const issues: SyncIssue[] = [];

  const result: ExcelPreview = {
    funcionarios: [],
    maquinas: [],
    ops: [],
    issues,
  };

  const funcionariosSheet = getSheet(workbook, 'funcionarios');
  const maquinasSheet = getSheet(workbook, 'maquinas');
  const opsSheet = getSheet(workbook, 'ops');

  if (!funcionariosSheet) issues.push({ sheet: 'funcionarios', message: 'Aba funcionarios não encontrada.' });
  if (!maquinasSheet) issues.push({ sheet: 'maquinas', message: 'Aba maquinas não encontrada.' });
  if (!opsSheet) issues.push({ sheet: 'ops', message: 'Aba ops não encontrada.' });

  if (funcionariosSheet) {
    const rows = normalizeRows(funcionariosSheet);
    validateColumns('funcionarios', rows, issues);
    result.funcionarios = parseFuncionarios(rows, issues);
  }

  if (maquinasSheet) {
    const rows = normalizeRows(maquinasSheet);
    validateColumns('maquinas', rows, issues);
    result.maquinas = parseMaquinas(rows, issues);
  }

  if (opsSheet) {
    const rows = normalizeRows(opsSheet);
    validateColumns('ops', rows, issues);
    result.ops = parseOps(rows, issues);
  }

  return result;
}

function stripDocMeta<T extends { $id?: string }>(item: T): Record<string, unknown> {
  const clone = { ...item } as Record<string, unknown>;
  delete clone.$id;
  Object.keys(clone).forEach((key) => {
    if (clone[key] === undefined) delete clone[key];
  });
  return clone;
}

function isSamePayload(existing: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.entries(next).every(([key, value]) => existing[key] === value);
}

async function syncCollection<T extends { $id?: string }>(params: {
  collection: SyncSummaryItem['collection'];
  uniqueField: keyof T & string;
  activeField: keyof T & string;
  incoming: T[];
  missingAction?: 'inactivate' | 'delete';
}): Promise<SyncSummaryItem> {
  const summary: SyncSummaryItem = {
    collection: params.collection,
    created: 0,
    updated: 0,
    inactivated: 0,
    deleted: 0,
    unchanged: 0,
    errors: 0,
  };

  const collectionId = COLLECTIONS[params.collection];
  const existing = await listAllDocuments<T>(collectionId);
  const existingMap = new Map<string, T>();

  existing.forEach((item) => {
    const key = String((item as Record<string, unknown>)[params.uniqueField] ?? '').trim().toUpperCase();
    if (key) existingMap.set(key, item);
  });

  const incomingKeys = new Set<string>();

  for (const item of params.incoming) {
    const payload = stripDocMeta(item);
    const key = String(payload[params.uniqueField] ?? '').trim().toUpperCase();
    if (!key) continue;
    incomingKeys.add(key);

    try {
      const current = existingMap.get(key);
      if (!current?.$id) {
        await createDocument<T>(collectionId, payload);
        summary.created += 1;
        continue;
      }

      if (isSamePayload(current as Record<string, unknown>, payload)) {
        summary.unchanged += 1;
      } else {
        await updateDocument<T>(collectionId, current.$id, payload);
        summary.updated += 1;
      }
    } catch (error) {
      console.error(`Erro ao sincronizar ${params.collection}:`, error);
      summary.errors += 1;
    }
  }

  const missingAction = params.missingAction ?? 'inactivate';

  for (const item of existing) {
    const key = String((item as Record<string, unknown>)[params.uniqueField] ?? '').trim().toUpperCase();
    const isActive = Boolean((item as Record<string, unknown>)[params.activeField]);

    if (!item.$id || !key || incomingKeys.has(key)) continue;

    try {
      if (missingAction === 'delete') {
        await deleteDocument(collectionId, item.$id);
        summary.deleted += 1;
      } else if (isActive) {
        await updateDocument<T>(collectionId, item.$id, { [params.activeField]: false });
        summary.inactivated += 1;
      }
    } catch (error) {
      const actionLabel = missingAction === 'delete' ? 'excluir' : 'inativar';
      console.error(`Erro ao ${actionLabel} ${params.collection}:`, error);
      summary.errors += 1;
    }
  }

  return summary;
}

export async function syncExcelBases(preview: ExcelPreview): Promise<SyncSummaryItem[]> {
  // Appwrite Cloud aplica limite de requisições por endpoint.
  // Por isso a sincronização é propositalmente sequencial, não paralela.
  const funcionarios = await syncCollection<Funcionario>({
    collection: 'funcionarios',
    uniqueField: 'matricula',
    activeField: 'ativo',
    incoming: preview.funcionarios,
  });

  const maquinas = await syncCollection<Maquina>({
    collection: 'maquinas',
    uniqueField: 'codigo_maquina',
    activeField: 'ativa',
    incoming: preview.maquinas,
  });

  const ops = await syncCollection<OP>({
    collection: 'ops',
    uniqueField: 'op',
    activeField: 'ativa',
    incoming: preview.ops,
    missingAction: 'delete',
  });

  return [funcionarios, maquinas, ops];
}

function getFirstSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const firstName = workbook.SheetNames[0];
  return firstName ? workbook.Sheets[firstName] : null;
}

function toInputDateTime(value: unknown): string {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.toISOString().slice(0, 10)}T12:00:00.000Z`;
  }

  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(normalizeText(value))) {
    const serial = Number(value);
    if (Number.isFinite(serial)) {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (parsed) {
        const yyyy = String(parsed.y).padStart(4, '0');
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T12:00:00.000Z`;
      }
    }
  }

  const text = normalizeText(value);
  const br = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) {
    const dd = br[1].padStart(2, '0');
    const mm = br[2].padStart(2, '0');
    const yyyy = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${yyyy}-${mm}-${dd}T12:00:00.000Z`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`;

  return text;
}

function getApontamentoKey(item: { [key: string]: unknown }) {
  return [
    String(item.data_apontamento ?? '').slice(0, 10),
    item.matricula,
    item.maquina,
    item.op,
    item.desenho,
    item.linha,
    item.potencia,
    item.qtd_produzida,
    item.obs,
  ].map((value) => normalizeKey(value)).join('|');
}

export async function parseApontamentosExcelFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const issues: SyncIssue[] = [];
  const sheet = getSheet(workbook, 'apontamentos' as SheetName) || getFirstSheet(workbook);

  if (!sheet) {
    return { apontamentos: [], issues: [{ sheet: 'apontamentos', message: 'Nenhuma aba encontrada no arquivo.' }] };
  }

  const rows = normalizeRows(sheet);
  const required = ['data', 'matricula', 'codmaq', 'qtdeprod', 'desenho', 'linha', 'potencia'];
  const available = new Set(Object.keys(rows[0] ?? {}));
  required.forEach((col) => {
    if (!available.has(col)) issues.push({ sheet: 'apontamentos', message: `Coluna obrigatória não encontrada: ${col}` });
  });

  const [funcionarios, maquinas, ops] = await Promise.all([
    listAllDocuments<Funcionario>(COLLECTIONS.funcionarios),
    listAllDocuments<Maquina>(COLLECTIONS.maquinas),
    listAllDocuments<OP>(COLLECTIONS.ops),
  ]);

  const funcionariosMap = new Map(funcionarios.map((item) => [normalizeKey(item.matricula), item]));
  const maquinasMap = new Map(maquinas.map((item) => [normalizeKey(item.codigo_maquina), item]));
  const opsMap = new Map(ops.map((item) => [normalizeKey(item.op), item]));

  const apontamentos = rows.map((row, index) => {
    const data = toInputDateTime(row.data);
    const matricula = normalizeKey(row.matricula);
    const maquinaCodigo = normalizeKey(row.codmaq);
    const op = normalizeKey(row.op);
    const qtd = normalizeNumber(row.qtdeprod);
    const desenho = normalizeKey(row.desenho);
    const linha = normalizeKey(row.linha);
    const potencia = normalizeText(row.potencia).replace(',', '.').toUpperCase();
    const obs = normalizeText(row.obs);
    // Quando a OP vier vazia no Excel, o registro é tratado automaticamente como REFORMA.
    // O campo op continua preenchido para respeitar a regra required do Appwrite.
    const isReforma = !op;
    const funcionario = funcionariosMap.get(matricula);
    const maquina = maquinasMap.get(maquinaCodigo);
    const opDoc = op ? opsMap.get(op) : null;
    const tipoEnrolamento = maquinaCodigo.includes('BOBAT') ? 'AT' : maquinaCodigo.includes('BOBBT') ? 'BT' : '';

    if (!data) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Data vazia ou inválida.' });
    if (!matricula) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Matrícula vazia.' });
    if (!maquinaCodigo) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Código da máquina vazio.' });
    if (!qtd || qtd <= 0) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Quantidade produzida deve ser maior que zero.' });
    if (!desenho) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Desenho vazio.' });
    if (!linha) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Linha vazia.' });
    if (!potencia) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Potência vazia.' });
    if (!funcionario) issues.push({ sheet: 'apontamentos', row: index + 2, message: `Funcionário não encontrado na base: ${matricula}` });
    if (!maquina) issues.push({ sheet: 'apontamentos', row: index + 2, message: `Máquina não encontrada na base: ${maquinaCodigo}` });
    if (!tipoEnrolamento) issues.push({ sheet: 'apontamentos', row: index + 2, message: `Máquina não identifica AT/BT: ${maquinaCodigo}` });
    if (!isReforma && !opDoc) issues.push({ sheet: 'apontamentos', row: index + 2, message: `OP não encontrada na base: ${op}` });

    return {
      data_apontamento: data,
      tipo_apontamento: isReforma ? 'REFORMA' : 'PRODUCAO',
      matricula,
      nome_operador: funcionario?.nome || '',
      setor_operador: funcionario?.setor || '',
      turno: funcionario?.turno || '',
      maquina: maquinaCodigo,
      setor_maquina: maquina?.setor || '',
      op: isReforma ? 'REFORMA' : op,
      desenho,
      desenho_manual: isReforma ? desenho : '',
      potencia_manual: isReforma ? potencia : '',
      linha_manual: isReforma ? linha : '',
      tipo_enrolamento: tipoEnrolamento,
      linha,
      potencia,
      produto: isReforma ? 'REFORMA' : opDoc?.produto || '',
      qtd_produzida: qtd,
      obs,
      excluido: false,
    };
  });

  const keys = new Set<string>();
  apontamentos.forEach((item, index) => {
    const key = getApontamentoKey(item);
    if (keys.has(key)) issues.push({ sheet: 'apontamentos', row: index + 2, message: 'Registro duplicado no Excel. Será importado apenas se ainda não existir no Appwrite.' });
    keys.add(key);
  });

  return { apontamentos, issues };
}

export async function syncApontamentosImport(preview: { apontamentos: Omit<import('@/types').Apontamento, '$id'>[]; issues: SyncIssue[] }): Promise<SyncSummaryItem> {
  const summary: SyncSummaryItem = {
    collection: 'apontamentos',
    created: 0,
    updated: 0,
    inactivated: 0,
    deleted: 0,
    unchanged: 0,
    errors: 0,
  };

  const existing = await listAllDocuments<import('@/types').Apontamento>(COLLECTIONS.apontamentos);
  const existingKeys = new Set(existing.map((item) => getApontamentoKey(item as unknown as Record<string, unknown>)));
  const importedKeys = new Set<string>();

  for (const item of preview.apontamentos) {
    const key = getApontamentoKey(item as unknown as Record<string, unknown>);
    if (importedKeys.has(key) || existingKeys.has(key)) {
      summary.unchanged += 1;
      continue;
    }

    importedKeys.add(key);

    try {
      await createDocument(COLLECTIONS.apontamentos, item as unknown as Record<string, unknown>);
      summary.created += 1;
    } catch (error) {
      console.error('Erro ao importar apontamento:', error);
      summary.errors += 1;
    }
  }

  return summary;
}
