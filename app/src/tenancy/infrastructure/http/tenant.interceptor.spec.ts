import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, defer } from 'rxjs';
import { TenantContextService } from '../../application/tenant-context.service';
import { TenantInterceptor } from './tenant.interceptor';

function executionContextFor(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TenantInterceptor', () => {
  const tenantContext = new TenantContextService();
  const interceptor = new TenantInterceptor(tenantContext);

  it('exécute le handler dans le contexte du tenant de la requête', async () => {
    const handler: CallHandler = {
      handle: () => defer(() => of(tenantContext.getCurrentTenant())),
    };

    const observedTenant = await firstValueFrom(
      interceptor.intercept(
        executionContextFor({ tenantContext: { slug: 'tenant-demo' } }),
        handler,
      ),
    );

    expect(observedTenant).toBe('tenant-demo');
  });

  it('reste hors contexte quand la requête ne porte pas de tenant', async () => {
    const handler: CallHandler = {
      handle: () => defer(() => of(tenantContext.getCurrentTenant())),
    };

    const observedTenant = await firstValueFrom(
      interceptor.intercept(executionContextFor({}), handler),
    );

    expect(observedTenant).toBeUndefined();
  });

  it('propage le contexte dans la chaîne async du handler', async () => {
    const handler: CallHandler = {
      handle: () =>
        defer(async () => {
          await Promise.resolve();
          return tenantContext.getCurrentTenant();
        }),
    };

    const observedTenant = await firstValueFrom(
      interceptor.intercept(
        executionContextFor({ tenantContext: { slug: 'tenant-demo' } }),
        handler,
      ),
    );

    expect(observedTenant).toBe('tenant-demo');
  });
});
