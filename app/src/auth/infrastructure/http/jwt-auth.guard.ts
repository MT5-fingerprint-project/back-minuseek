import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantResolutionError } from './tenant-resolution.errors';

/**
 * Guard global (APP_GUARD) — toute route exige un token Keycloak valide.
 * Aucun opt-out : si un endpoint infra doit être non authentifié, l'exclure
 * au niveau ingress, jamais ici.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
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
