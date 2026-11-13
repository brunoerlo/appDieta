const MONTHS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

/**
 * Returns today's local date in YYYY-MM-DD format.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Shifts a YYYY-MM-DD date string by `deltaDays` days and returns YYYY-MM-DD.
 */
export function shiftDateString(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return getTodayDateString();
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + deltaDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string into a friendly Portuguese label:
 * "Hoje (09/11)", "Ontem (08/11)", or "07 de Nov, 2026".
 */
export function formatDatePortuguese(dateStr: string): string {
  if (!dateStr) return 'Hoje';
  const todayStr = getTodayDateString();
  const yesterdayStr = shiftDateString(todayStr, -1);

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2];

  if (dateStr === todayStr) {
    return `Hoje (${day}/${parts[1]})`;
  }
  if (dateStr === yesterdayStr) {
    return `Ontem (${day}/${parts[1]})`;
  }

  const monthName = MONTHS_PT[monthIdx] || parts[1];
  return `${day} de ${monthName}, ${year}`;
}
