const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Tout ce qui vient de la base est du texte libre : rien n'entre brut dans le HTML. */
export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Horodatage en temps universel : la mention UTC figure dans les en-têtes. */
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

export function formatJson(value: Record<string, unknown>): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}
