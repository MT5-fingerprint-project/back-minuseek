import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

export interface TenantContext {
  slug: string;
}

type TenantAwareUser = {
  tenantSlug?: string;
  isSystemRealm?: boolean;
};

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: TenantAwareUser;
        tenantContext?: TenantContext;
      }
    >();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException();
    }
    if (user.isSystemRealm) {
      throw new ForbiddenException();
    }
    if (!user.tenantSlug) {
      throw new ForbiddenException();
    }

    request.tenantContext = { slug: user.tenantSlug };
    return true;
  }
}
