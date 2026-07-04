import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';

export abstract class TenantResolutionError extends Error {
  abstract toHttpException(): HttpException;
}

export class TenantHeaderMissingError extends TenantResolutionError {
  constructor() {
    super('X-Tenant-Slug header is required');
  }

  toHttpException(): HttpException {
    return new ForbiddenException('X-Tenant-Slug header is required');
  }
}

export class UnknownTenantError extends TenantResolutionError {
  constructor(slug: string) {
    super(`Unknown tenant: ${slug}`);
  }

  toHttpException(): HttpException {
    // Même réponse qu'un slug malformé : ne pas révéler quels tenants existent.
    return new ForbiddenException('Unknown tenant');
  }
}

export class TenantIssuerMismatchError extends TenantResolutionError {
  constructor(slug: string) {
    super(`Token issuer does not match tenant: ${slug}`);
  }

  toHttpException(): HttpException {
    return new UnauthorizedException();
  }
}
