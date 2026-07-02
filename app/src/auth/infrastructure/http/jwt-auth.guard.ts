import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard global (APP_GUARD) — toute route exige un token Keycloak valide.
 * Aucun opt-out : si un endpoint infra doit être non authentifié, l'exclure
 * au niveau ingress, jamais ici.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
