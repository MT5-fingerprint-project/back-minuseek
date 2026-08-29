import type { Request } from 'express';

export const CLOUDFLARE_CLIENT_IP_HEADER = 'cf-connecting-ip';

export function cloudflareClientIp(request: Request): string {
  const header = request.headers[CLOUDFLARE_CLIENT_IP_HEADER];
  const declared = Array.isArray(header) ? header[0] : header;
  if (typeof declared === 'string' && declared.trim().length > 0) {
    return declared.trim();
  }
  return request.socket?.remoteAddress ?? request.ip ?? 'inconnue';
}
