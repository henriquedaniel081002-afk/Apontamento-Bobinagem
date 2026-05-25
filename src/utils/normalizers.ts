export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeKey(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

export function normalizeBoolean(value: unknown, defaultValue = true): boolean {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const text = normalizeText(value).toLowerCase();
  if (['true', 'sim', 's', 'ativo', 'ativa', '1', 'yes', 'y'].includes(text)) return true;
  if (['false', 'nao', 'não', 'n', 'inativo', 'inativa', '0', 'no'].includes(text)) return false;

  return defaultValue;
}

export function normalizeNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'number') return Number.isFinite(value) ? value : defaultValue;

  const clean = normalizeText(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function normalizeDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return normalizeText(value);
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
