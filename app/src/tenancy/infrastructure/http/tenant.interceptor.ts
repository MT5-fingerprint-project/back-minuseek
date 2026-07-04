import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import {
  TenantContext,
  TenantContextService,
} from '../../application/tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenantContext?: TenantContext }>();
    const requestTenant = request.tenantContext;

    if (!requestTenant) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      const subscription = this.tenantContext.run(requestTenant, () =>
        next.handle().subscribe(subscriber),
      );
      return () => subscription.unsubscribe();
    });
  }
}
