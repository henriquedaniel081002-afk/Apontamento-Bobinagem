export function isPositiveQuantity(value: string): boolean {
  const numericValue = Number(value.replace(',', '.'));
  return Number.isFinite(numericValue) && numericValue > 0;
}

export function isFutureDate(date: Date): boolean {
  const now = new Date();
  return date.getTime() > now.getTime();
}
