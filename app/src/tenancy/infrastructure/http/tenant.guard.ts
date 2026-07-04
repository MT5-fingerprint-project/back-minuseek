import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { TenantContext } from '../../application/tenant-context.service';
import { SYSTEM_REALM_ONLY_KEY } from './system-realm-only.decorator';

type TenantAwareUser = {
  tenantSlug?: string;
  isSystemRealm?: boolean;
};

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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

    const systemRealmOnly = this.reflector.getAllAndOverride<boolean>(
      SYSTEM_REALM_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (systemRealmOnly) {
      if (!user.isSystemRealm) {
        throw new ForbiddenException();
      }
      return true;
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
