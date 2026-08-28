const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

export function formatJson(value: Record<string, unknown>): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}
