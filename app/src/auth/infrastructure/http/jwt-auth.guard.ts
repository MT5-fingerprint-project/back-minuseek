import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PUBLIC_ROUTE_KEY } from './public-route.decorator';
import { TenantResolutionError } from './tenant-resolution.errors';

/**
 * Guard global (APP_GUARD) — toute route exige un token Keycloak valide.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      PUBLIC_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    return isPublic ? true : super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    // passport-jwt remonte les erreurs du secretOrKeyProvider via fail()
    // → elles arrivent dans `info` (err reste null) ; celles de validate()
    // arrivent dans `err`. On couvre les deux canaux.
    const tenantError = [err, info].find(
      (candidate): candidate is TenantResolutionError =>
        candidate instanceof TenantResolutionError,
    );
    if (tenantError) {
      throw tenantError.toHttpException();
    }
    if (err || !user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
