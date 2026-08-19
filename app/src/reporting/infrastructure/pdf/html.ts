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

export function formatDate(value: Date | null): string {
  return value ? value.toISOString().replace('T', ' ').slice(0, 19) : '—';
}

export function formatJson(value: Record<string, unknown>): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}
