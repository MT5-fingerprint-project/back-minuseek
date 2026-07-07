import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  TenantHeaderMissingError,
  TenantIssuerMismatchError,
  UnknownTenantError,
} from './tenant-resolution.errors';

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard();

  it('renvoie le user quand la validation a réussi', () => {
    const user = { sub: 'user-1' };
    expect(guard.handleRequest(null, user, undefined)).toBe(user);
  });

  // Convention passport-jwt : une erreur du secretOrKeyProvider passe par
  // fail() et arrive dans `info` (err = null, user = false).
  it('mappe TenantHeaderMissingError reçu via info en 403', () => {
    expect(() =>
      guard.handleRequest(null, false, new TenantHeaderMissingError()),
    ).toThrow(ForbiddenException);
  });

  it('mappe UnknownTenantError reçu via info en 403', () => {
    expect(() =>
      guard.handleRequest(null, false, new UnknownTenantError('intrus')),
    ).toThrow(ForbiddenException);
  });

  it('mappe TenantIssuerMismatchError reçu via info en 401', () => {
    expect(() =>
      guard.handleRequest(null, false, new TenantIssuerMismatchError('demo')),
    ).toThrow(UnauthorizedException);
  });

  // Une erreur levée dans validate() arrive, elle, dans `err`.
  it('mappe aussi une TenantResolutionError reçue via err', () => {
    expect(() =>
      guard.handleRequest(new TenantHeaderMissingError(), false, undefined),
    ).toThrow(ForbiddenException);
  });

  it('retombe sur 401 pour tout autre échec', () => {
    expect(() =>
      guard.handleRequest(null, false, new Error('jwt expired')),
    ).toThrow(UnauthorizedException);
    expect(() => guard.handleRequest(null, false, undefined)).toThrow(
      UnauthorizedException,
    );
  });
});
