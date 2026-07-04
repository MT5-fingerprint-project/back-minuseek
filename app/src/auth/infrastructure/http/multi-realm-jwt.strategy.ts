import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { Request } from 'express';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { AuthenticatedUser, TENANT_SLUG_HEADER } from './auth.types';
import {
  TenantHeaderMissingError,
  TenantIssuerMismatchError,
  UnknownTenantError,
} from './tenant-resolution.errors';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

// Longueur bornée : le lookup registre tourne AVANT toute preuve de signature,
// on ne laisse pas un client anonyme fabriquer des clés arbitrairement longues.
const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

type SecretProvider = (
  request: unknown,
  rawJwtToken: string,
  done: (error: Error | null, secret?: string) => void,
) => void;

export function decodeIssuerClaim(rawJwtToken: string): string | null {
  const payloadPart = rawJwtToken.split('.')[1];
  if (!payloadPart) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    );
    if (payload && typeof payload === 'object' && 'iss' in payload) {
      const issuer = payload.iss;
      return typeof issuer === 'string' ? issuer : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function issuerForRealm(publicUrl: string, realm: string): string {
  return `${publicUrl}/realms/${realm}`;
}

/**
 * Multi-realm JWT strategy. Ensures X-Tenant-Slug, the `iss` (issuer) claim,
 * and the JWKS-signing realm all resolve to the same tenant.
 *
 * 1. X-Tenant-Slug → registry lookup (unknown/missing → 403, no network call).
 * 2. Decoded `iss` must match the expected issuer for that tenant.
 * 3. Signature verified against the realm's JWKS (cached, rate-limited).
 * 4. validate() re-checks issuer and attaches tenantSlug to request.user.
 *
 * System realm (KEYCLOAK_SYSTEM_REALM, optional): token without tenant header
 * whose issuer matches the system realm → isSystemRealm, no tenantSlug.
 */
@Injectable()
export class MultiRealmJwtStrategy extends PassportStrategy(Strategy) {
  private readonly publicUrl = requireEnv('KEYCLOAK_PUBLIC_URL');
  private readonly internalUrl = requireEnv('KEYCLOAK_INTERNAL_URL');
  private readonly systemRealm = process.env.KEYCLOAK_SYSTEM_REALM;
  private readonly jwksProvidersByRealm = new Map<string, SecretProvider>();

  constructor(private readonly tenantRegistry: TenantRegistryService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      audience: requireEnv('KEYCLOAK_AUDIENCE'),
      passReqToCallback: true,
      secretOrKeyProvider: (
        request: unknown,
        rawJwtToken: string,
        done: (error: Error | null, secret?: string) => void,
      ) => {
        void this.provideSigningKey(request as Request, rawJwtToken, done);
      },
    });
  }

  private async provideSigningKey(
    request: Request,
    rawJwtToken: string,
    done: (error: Error | null, secret?: string) => void,
  ): Promise<void> {
    try {
      const realm = await this.resolveExpectedRealm(request, rawJwtToken);
      this.jwksProviderForRealm(realm)(request, rawJwtToken, done);
    } catch (error) {
      done(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async resolveExpectedRealm(
    request: Request,
    rawJwtToken: string,
  ): Promise<string> {
    const slug = this.readTenantSlugHeader(request);
    const tokenIssuer = decodeIssuerClaim(rawJwtToken);

    if (!slug) {
      if (
        this.systemRealm &&
        tokenIssuer === issuerForRealm(this.publicUrl, this.systemRealm)
      ) {
        return this.systemRealm;
      }
      throw new TenantHeaderMissingError();
    }

    if (!TENANT_SLUG_PATTERN.test(slug)) {
      throw new UnknownTenantError(slug);
    }
    const record = await this.tenantRegistry.findBySlug(slug);
    if (!record) {
      throw new UnknownTenantError(slug);
    }
    if (
      tokenIssuer !==
      issuerForRealm(this.publicUrl, record.identityProviderRealm)
    ) {
      throw new TenantIssuerMismatchError(slug);
    }
    return record.identityProviderRealm;
  }

  private readTenantSlugHeader(request: Request): string | undefined {
    const headerValue = request.headers[TENANT_SLUG_HEADER];
    if (Array.isArray(headerValue)) {
      // Header dupliqué : ambigu, on le traite comme absent plutôt que de
      // choisir silencieusement une valeur.
      return undefined;
    }
    return headerValue || undefined;
  }

  private jwksProviderForRealm(realm: string): SecretProvider {
    const existing = this.jwksProvidersByRealm.get(realm);
    if (existing) {
      return existing;
    }
    const provider = passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: `${this.internalUrl}/realms/${realm}/protocol/openid-connect/certs`,
    }) as SecretProvider;
    this.jwksProvidersByRealm.set(realm, provider);
    return provider;
  }

  async validate(
    request: Request,
    payload: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    const slug = this.readTenantSlugHeader(request);

    if (!slug) {
      return { ...payload, isSystemRealm: true };
    }

    const record = await this.tenantRegistry.findBySlug(slug);
    if (
      !record ||
      payload.iss !==
        issuerForRealm(this.publicUrl, record.identityProviderRealm)
    ) {
      throw new UnauthorizedException();
    }
    return { ...payload, tenantSlug: record.slug, isSystemRealm: false };
  }
}
