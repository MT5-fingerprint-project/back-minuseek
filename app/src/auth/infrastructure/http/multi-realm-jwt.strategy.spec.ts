import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  MultiRealmJwtStrategy,
  decodeIssuerClaim,
  issuerForRealm,
} from './multi-realm-jwt.strategy';
import {
  TenantHeaderMissingError,
  TenantIssuerMismatchError,
  UnknownTenantError,
} from './tenant-resolution.errors';
import type { TenantRecord } from '../../../tenancy/application/tenant-registry.service';

const PUBLIC_URL = 'http://localhost:8080';

const DEMO_TENANT: TenantRecord = {
  id: '5f1e7c1a-0000-4000-8000-000000000001',
  slug: 'tenant-demo',
  displayName: 'Tenant démo',
  databaseName: 'minuseek',
  identityProviderRealm: 'minuseek-tenant-demo',
};

class InMemoryTenantRegistry {
  constructor(private readonly records: TenantRecord[]) {}

  findBySlug(slug: string): Promise<TenantRecord | null> {
    return Promise.resolve(
      this.records.find((record) => record.slug === slug) ?? null,
    );
  }

  invalidate(): void {}
}

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (part: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(part)).toString('base64url');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`;
}

function requestWithHeaders(headers: Record<string, unknown>): Request {
  return { headers } as unknown as Request;
}

function buildStrategy(records: TenantRecord[] = [DEMO_TENANT]) {
  return new MultiRealmJwtStrategy(
    new InMemoryTenantRegistry(records) as never,
  );
}

/** Invoque le secretOrKeyProvider privé et capture l'issue (erreur ou realm
 * dont le JWKS a été résolu). */
async function resolveRealm(
  strategy: MultiRealmJwtStrategy,
  headers: Record<string, unknown>,
  issuer: string | undefined,
): Promise<string> {
  const internals = strategy as unknown as {
    resolveExpectedRealm(
      request: Request,
      rawJwtToken: string,
    ): Promise<string>;
  };
  return internals.resolveExpectedRealm(
    requestWithHeaders(headers),
    tokenWithPayload(issuer === undefined ? {} : { iss: issuer }),
  );
}

describe('decodeIssuerClaim', () => {
  it('extrait le claim iss sans vérifier la signature', () => {
    const issuer = issuerForRealm(PUBLIC_URL, 'minuseek-tenant-demo');
    expect(decodeIssuerClaim(tokenWithPayload({ iss: issuer }))).toBe(issuer);
  });

  it('renvoie null pour un token malformé ou sans iss', () => {
    expect(decodeIssuerClaim('not-a-jwt')).toBeNull();
    expect(decodeIssuerClaim(tokenWithPayload({}))).toBeNull();
    expect(decodeIssuerClaim(tokenWithPayload({ iss: 42 }))).toBeNull();
  });
});

describe('MultiRealmJwtStrategy — résolution du realm attendu', () => {
  beforeEach(() => {
    process.env.KEYCLOAK_PUBLIC_URL = PUBLIC_URL;
    process.env.KEYCLOAK_INTERNAL_URL = 'http://keycloak:8080';
    process.env.KEYCLOAK_AUDIENCE = 'minuseek-api';
    delete process.env.KEYCLOAK_SYSTEM_REALM;
  });

  const demoIssuer = issuerForRealm(
    PUBLIC_URL,
    DEMO_TENANT.identityProviderRealm,
  );

  it('résout le realm du tenant quand header, iss et registre concordent', async () => {
    await expect(
      resolveRealm(
        buildStrategy(),
        { 'x-tenant-slug': 'tenant-demo' },
        demoIssuer,
      ),
    ).resolves.toBe('minuseek-tenant-demo');
  });

  it('rejette sans header tenant (403, aucun realm résolu)', async () => {
    await expect(resolveRealm(buildStrategy(), {}, demoIssuer)).rejects.toThrow(
      TenantHeaderMissingError,
    );
  });

  it('traite un header dupliqué comme absent', async () => {
    await expect(
      resolveRealm(
        buildStrategy(),
        { 'x-tenant-slug': ['tenant-demo', 'autre'] },
        demoIssuer,
      ),
    ).rejects.toThrow(TenantHeaderMissingError);
  });

  it('rejette un slug inconnu du registre sans résoudre de JWKS', async () => {
    await expect(
      resolveRealm(buildStrategy(), { 'x-tenant-slug': 'intrus' }, demoIssuer),
    ).rejects.toThrow(UnknownTenantError);
  });

  it('rejette un slug malformé avant tout accès registre', async () => {
    await expect(
      resolveRealm(
        buildStrategy(),
        { 'x-tenant-slug': 'Bad Slug!' },
        demoIssuer,
      ),
    ).rejects.toThrow(UnknownTenantError);
  });

  it('rejette un slug trop long (borne anti-DoS pré-auth)', async () => {
    await expect(
      resolveRealm(
        buildStrategy(),
        { 'x-tenant-slug': 'a'.repeat(64) },
        demoIssuer,
      ),
    ).rejects.toThrow(UnknownTenantError);
  });

  it("rejette un token dont l'iss ne désigne pas le realm du tenant déclaré", async () => {
    const foreignIssuer = issuerForRealm(PUBLIC_URL, 'minuseek-autre-tenant');
    await expect(
      resolveRealm(
        buildStrategy(),
        { 'x-tenant-slug': 'tenant-demo' },
        foreignIssuer,
      ),
    ).rejects.toThrow(TenantIssuerMismatchError);
  });

  it('rejette un token sans claim iss', async () => {
    await expect(
      resolveRealm(
        buildStrategy(),
        { 'x-tenant-slug': 'tenant-demo' },
        undefined,
      ),
    ).rejects.toThrow(TenantIssuerMismatchError);
  });

  it('accepte un token du realm système sans header, si configuré', async () => {
    process.env.KEYCLOAK_SYSTEM_REALM = 'minuseek-system';
    const systemIssuer = issuerForRealm(PUBLIC_URL, 'minuseek-system');
    await expect(resolveRealm(buildStrategy(), {}, systemIssuer)).resolves.toBe(
      'minuseek-system',
    );
  });
});

describe('MultiRealmJwtStrategy — validate (post-signature)', () => {
  beforeEach(() => {
    process.env.KEYCLOAK_PUBLIC_URL = PUBLIC_URL;
    process.env.KEYCLOAK_INTERNAL_URL = 'http://keycloak:8080';
    process.env.KEYCLOAK_AUDIENCE = 'minuseek-api';
    delete process.env.KEYCLOAK_SYSTEM_REALM;
  });

  const demoIssuer = issuerForRealm(
    PUBLIC_URL,
    DEMO_TENANT.identityProviderRealm,
  );

  it('attache le tenantSlug prouvé au user', async () => {
    const user = await buildStrategy().validate(
      requestWithHeaders({ 'x-tenant-slug': 'tenant-demo' }),
      { sub: 'user-1', iss: demoIssuer },
    );
    expect(user.tenantSlug).toBe('tenant-demo');
    expect(user.isSystemRealm).toBe(false);
  });

  it('re-rejette si le registre ne connaît plus le tenant au moment du validate', async () => {
    await expect(
      buildStrategy([]).validate(
        requestWithHeaders({ 'x-tenant-slug': 'tenant-demo' }),
        { sub: 'user-1', iss: demoIssuer },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('marque isSystemRealm sans poser de tenantSlug pour un token sans header', async () => {
    const user = await buildStrategy().validate(requestWithHeaders({}), {
      sub: 'admin-1',
    });
    expect(user.isSystemRealm).toBe(true);
    expect(user.tenantSlug).toBeUndefined();
  });
});
