export type AppDateLocale = 'es' | 'en-US';

export function parseAppDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
    if (
      parsed.getFullYear() !== Number(year) ||
      parsed.getMonth() !== Number(month) - 1 ||
      parsed.getDate() !== Number(day)
    ) {
      return null;
    }
    return parsed;
  }

  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAppDate(value: string | null | undefined, locale: AppDateLocale): string {
  if (!value) return '—';
  const date = parseAppDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatAppDateTime(value: string | null | undefined, locale: AppDateLocale): string {
  if (!value) return '—';
  const date = parseAppDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: locale === 'es' ? 'h23' : undefined,
  }).format(date);
}
