function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function formatDate(value: Date | null): string {
  if (!value) {
    return '—';
  }
  return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()} ${pad(
    value.getUTCHours(),
  )}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
}

export function formatDay(value: Date | null): string {
  if (!value) {
    return '—';
  }
  return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
}

export function formatHourMinute(value: Date): string {
  return `${pad(value.getUTCHours())} h ${pad(value.getUTCMinutes())}`;
}

export function formatDayTime(value: Date | null): string {
  if (!value) {
    return '—';
  }
  return `${formatDay(value)} à ${pad(value.getUTCHours())} h ${pad(
    value.getUTCMinutes(),
  )}`;
}

export function formatLongDay(value: Date | null): string {
  if (!value) {
    return '—';
  }
  const day = value.getUTCDate();
  return `${day === 1 ? '1er' : day} ${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}
