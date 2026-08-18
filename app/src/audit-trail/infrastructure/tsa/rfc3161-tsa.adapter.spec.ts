import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Rfc3161TsaAdapter } from './rfc3161-tsa.adapter';
import { readTstInfo, verifyTimestampMatches } from './rfc3161';
import { TimestampAuthorityError } from './timestamp-authority.error';

// TSR réel obtenu une fois contre freetsa.org, commité en .der : c'est le seul
// moyen de contraindre le parsing sur ce qu'une vraie TSA renvoie.
const FIXTURE_TSR = readFileSync(
  join(__dirname, '__fixtures__', 'freetsa-response.der'),
);
const FIXTURE_DIGEST = createHash('sha256').update('minuseek-fixture').digest();
const FIXTURE_NONCE = Buffer.from('0102030405060708090a0b0c0d0e0f10', 'hex');
const FIXTURE_GEN_TIME = new Date('2026-08-18T21:55:44.000Z');

describe("lecture d'un TSR RFC 3161", () => {
  it('lit le genTime du TSTInfo', () => {
    const tstInfo = readTstInfo(FIXTURE_TSR);

    expect(tstInfo.genTime).toEqual(FIXTURE_GEN_TIME);
  });

  it('accepte le condensat et le nonce effectivement horodatés', () => {
    const tstInfo = readTstInfo(FIXTURE_TSR);

    expect(() =>
      verifyTimestampMatches(tstInfo, FIXTURE_DIGEST, FIXTURE_NONCE),
    ).not.toThrow();
  });

  it("refuse un condensat qui n'est pas celui horodaté", () => {
    const tstInfo = readTstInfo(FIXTURE_TSR);
    const otherDigest = createHash('sha256').update('autre chose').digest();

    expect(() => verifyTimestampMatches(tstInfo, otherDigest)).toThrow(
      TimestampAuthorityError,
    );
  });

  it('refuse un nonce non réfléchi', () => {
    const tstInfo = readTstInfo(FIXTURE_TSR);

    expect(() =>
      verifyTimestampMatches(tstInfo, FIXTURE_DIGEST, Buffer.alloc(16, 9)),
    ).toThrow(TimestampAuthorityError);
  });

  it('refuse une réponse illisible', () => {
    expect(() => readTstInfo(Buffer.from('pas du ASN.1'))).toThrow(
      TimestampAuthorityError,
    );
  });
});

describe('Rfc3161TsaAdapter', () => {
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.TSA_URL = 'https://freetsa.org/tsr';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function stubTsa(response: { ok?: boolean; status?: number; body?: Buffer }) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      arrayBuffer: () => Promise.resolve(response.body ?? Buffer.alloc(0)),
    });
  }

  it('rend le genTime et le TSR brut de la TSA', async () => {
    stubTsa({ body: FIXTURE_TSR });
    const adapter = new Rfc3161TsaAdapter(() => FIXTURE_NONCE);

    const token = await adapter.timestamp(FIXTURE_DIGEST.toString('hex'));

    expect(token.tsaUrl).toBe('https://freetsa.org/tsr');
    expect(token.genTime).toEqual(FIXTURE_GEN_TIME);
    expect(token.tsrDer.equals(FIXTURE_TSR)).toBe(true);
  });

  it("refuse un condensat qui n'est pas un SHA-256", async () => {
    stubTsa({ body: FIXTURE_TSR });
    const adapter = new Rfc3161TsaAdapter(() => FIXTURE_NONCE);

    await expect(adapter.timestamp('trop court')).rejects.toThrow(
      TimestampAuthorityError,
    );
  });

  it('traduit une TSA en erreur HTTP en erreur applicative', async () => {
    stubTsa({ ok: false, status: 503 });
    const adapter = new Rfc3161TsaAdapter(() => FIXTURE_NONCE);

    await expect(
      adapter.timestamp(FIXTURE_DIGEST.toString('hex')),
    ).rejects.toThrow(TimestampAuthorityError);
  });

  it('refuse un TSR qui horodate un autre condensat que le nôtre', async () => {
    stubTsa({ body: FIXTURE_TSR });
    const adapter = new Rfc3161TsaAdapter(() => FIXTURE_NONCE);
    const otherDigest = createHash('sha256').update('autre chose').digest();

    await expect(
      adapter.timestamp(otherDigest.toString('hex')),
    ).rejects.toThrow(TimestampAuthorityError);
  });
});
