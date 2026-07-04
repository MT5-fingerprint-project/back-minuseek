import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const service = new TenantContextService();

  it('expose le tenant à l’intérieur de run(), rien à l’extérieur', () => {
    expect(service.getCurrentTenant()).toBeUndefined();

    const insideRun = service.run({ slug: 'tenant-demo' }, () =>
      service.getCurrentTenant(),
    );

    expect(insideRun).toBe('tenant-demo');
    expect(service.getCurrentTenant()).toBeUndefined();
  });

  it('propage le contexte à travers la chaîne async', async () => {
    const observedTenant = await service.run(
      { slug: 'tenant-demo' },
      async () => {
        await Promise.resolve();
        return service.getCurrentTenant();
      },
    );
    expect(observedTenant).toBe('tenant-demo');
  });

  it('isole deux contextes concurrents', async () => {
    const [first, second] = await Promise.all([
      service.run({ slug: 'tenant-a' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getCurrentTenant();
      }),
      service.run({ slug: 'tenant-b' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return service.getCurrentTenant();
      }),
    ]);
    expect(first).toBe('tenant-a');
    expect(second).toBe('tenant-b');
  });
});
