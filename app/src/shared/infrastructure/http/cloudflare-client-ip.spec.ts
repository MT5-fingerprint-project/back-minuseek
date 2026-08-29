import type { Request } from 'express';
import { cloudflareClientIp } from './cloudflare-client-ip';

function request(
  headers: Record<string, string | string[]>,
  remoteAddress?: string,
): Request {
  return {
    headers,
    socket: { remoteAddress },
    ip: undefined,
  } as unknown as Request;
}

describe('cloudflareClientIp', () => {
  it("retient l'adresse posée par Cloudflare", () => {
    expect(
      cloudflareClientIp(request({ 'cf-connecting-ip': '203.0.113.7' })),
    ).toBe('203.0.113.7');
  });

  it("retombe sur l'adresse de la connexion en l'absence d'en-tête", () => {
    expect(cloudflareClientIp(request({}, '198.51.100.4'))).toBe(
      '198.51.100.4',
    );
  });

  it("ne lit jamais un X-Forwarded-For, qu'un client peut forger", () => {
    expect(
      cloudflareClientIp(
        request({ 'x-forwarded-for': '1.2.3.4' }, '198.51.100.4'),
      ),
    ).toBe('198.51.100.4');
  });

  it("préfère l'en-tête Cloudflare à un X-Forwarded-For contradictoire", () => {
    expect(
      cloudflareClientIp(
        request(
          { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4' },
          '198.51.100.4',
        ),
      ),
    ).toBe('203.0.113.7');
  });

  it('ignore un en-tête Cloudflare vide', () => {
    expect(
      cloudflareClientIp(
        request({ 'cf-connecting-ip': '   ' }, '198.51.100.4'),
      ),
    ).toBe('198.51.100.4');
  });

  it("ne retient que la première valeur d'un en-tête répété", () => {
    expect(
      cloudflareClientIp(
        request({ 'cf-connecting-ip': ['203.0.113.7', '1.2.3.4'] }),
      ),
    ).toBe('203.0.113.7');
  });

  it("nomme l'adresse inconnue plutôt que de compter sur `undefined`", () => {
    expect(cloudflareClientIp(request({}))).toBe('inconnue');
  });
});
