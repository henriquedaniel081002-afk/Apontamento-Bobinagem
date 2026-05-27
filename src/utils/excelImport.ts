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
