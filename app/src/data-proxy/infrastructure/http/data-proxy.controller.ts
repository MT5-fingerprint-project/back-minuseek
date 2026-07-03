import { All, BadGatewayException, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';

const EXCLUDED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
]);

const EXCLUDED_RESPONSE_HEADERS = new Set(['connection', 'transfer-encoding']);

// Reverse-proxy vers le service data interne : le back reste le seul point d'entrée réseau.
// Exclu du préfixe global 'api' (cf. main.ts) pour matcher le chemin /data/api attendu par le front.
@Controller('data/api')
export class DataProxyController {
  @All('*path')
  async proxy(@Req() req: Request, @Res() res: Response) {
    const target = process.env.DATA_API_URL;
    if (!target) {
      throw new BadGatewayException('Le service data est indisponible');
    }

    const url = new URL(req.originalUrl, target);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value || EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase())) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const contentType = req.headers['content-type'] ?? '';
    let body: BodyInit | undefined;
    if (hasBody) {
      if (contentType.includes('application/json')) {
        body = JSON.stringify(req.body ?? {});
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        body = new URLSearchParams(
          req.body as Record<string, string>,
        ).toString();
      } else {
        body = Readable.toWeb(req) as ReadableStream;
      }
    }

    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      duplex: body instanceof ReadableStream ? 'half' : undefined,
    } as RequestInit);

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (upstream.body) {
      Readable.fromWeb(upstream.body as never).pipe(res);
    } else {
      res.end();
    }
  }
}
