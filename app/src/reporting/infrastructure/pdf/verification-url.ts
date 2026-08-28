import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import type { VerificationUrlPort } from '../../application/ports/verification-url.port';

export class MissingTenantForVerificationUrlError extends Error {
  constructor() {
    super(
      "L'adresse de vérification exige un laboratoire courant : aucun n'est posé dans le contexte",
    );
    this.name = 'MissingTenantForVerificationUrlError';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

@Injectable()
export class FrontOriginVerificationUrl implements VerificationUrlPort {
  constructor(private readonly tenantContext: TenantContextService) {}

  build(): string {
    const origin = requireEnv('FRONT_ORIGIN').replace(/\/+$/, '');
    const slug = this.tenantContext.getCurrentTenant();
    if (!slug) {
      throw new MissingTenantForVerificationUrlError();
    }
    return `${origin}/${slug}/verifier`;
  }
}
