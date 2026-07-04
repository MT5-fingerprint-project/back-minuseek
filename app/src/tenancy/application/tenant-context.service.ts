import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  slug: string;
}

@Injectable()
export class TenantContextService {
  private static readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return TenantContextService.storage.run(context, callback);
  }

  getCurrentTenant(): string | undefined {
    return TenantContextService.storage.getStore()?.slug;
  }

  getContext(): TenantContext | undefined {
    return TenantContextService.storage.getStore();
  }
}
