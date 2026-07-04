import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import type { TenantContext } from '../../application/tenant-context.service';

type GuardedRequest = {
  user?: { tenantSlug?: string; isSystemRealm?: boolean };
  tenantContext?: TenantContext;
};

function executionContextFor(request: GuardedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  it('pose request.tenantContext depuis le tenant prouvé par la stratégie', () => {
    const request: GuardedRequest = { user: { tenantSlug: 'tenant-demo' } };
    expect(guard.canActivate(executionContextFor(request))).toBe(true);
    expect(request.tenantContext).toEqual({ slug: 'tenant-demo' });
  });

  it('rejette un token système sur les routes métier (deny-by-default, IA-12)', () => {
    const request: GuardedRequest = { user: { isSystemRealm: true } };
    expect(() => guard.canActivate(executionContextFor(request))).toThrow(
      ForbiddenException,
    );
    expect(request.tenantContext).toBeUndefined();
  });

  it('rejette une requête sans user (ordre de guards cassé)', () => {
    expect(() => guard.canActivate(executionContextFor({}))).toThrow(
      ForbiddenException,
    );
  });

  it('rejette un user sans tenant prouvé ni realm système', () => {
    expect(() => guard.canActivate(executionContextFor({ user: {} }))).toThrow(
      ForbiddenException,
    );
  });
});
