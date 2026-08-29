import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PUBLIC_ROUTE_KEY } from './public-route.decorator';
import {
  TenantHeaderMissingError,
  TenantIssuerMismatchError,
  UnknownTenantError,
} from './tenant-resolution.errors';

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard(new Reflector());

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

describe('JwtAuthGuard.canActivate', () => {
  function context(): ExecutionContext {
    return {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, url: '/api/investigation-cases' }),
        getResponse: () => ({
          setHeader: () => undefined,
          end: () => undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  function reflectorSaying(isPublic: boolean): Reflector {
    return {
      getAllAndOverride: () => isPublic,
    } as unknown as Reflector;
  }

  it('laisse passer une route explicitement publique, sans jeton', () => {
    const guard = new JwtAuthGuard(reflectorSaying(true));

    expect(guard.canActivate(context())).toBe(true);
  });

  it('exige un jeton partout ailleurs : la dérogation ne fuit pas', async () => {
    const asked: unknown[] = [];
    const guard = new JwtAuthGuard({
      getAllAndOverride: (key: unknown) => {
        asked.push(key);
        return false;
      },
    } as unknown as Reflector);

    await expect(guard.canActivate(context())).rejects.toThrow(Error);
    expect(asked).toEqual([PUBLIC_ROUTE_KEY]);
  });
});
