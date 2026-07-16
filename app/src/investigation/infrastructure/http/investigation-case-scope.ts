import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';

/** Scope de visibilité des affaires pour l'utilisateur courant (INV-12). */
export interface InvestigationCaseScope {
  /** Restreint aux affaires assignées à cet opérateur ;
   * `undefined` = tout le tenant. */
  operatorId?: string;
}

/**
 * INV-12 : OPERATOR → ses affaires assignées ; ADMIN → tout le tenant ;
 * AUDITOR → lecture seule ; SUPERADMIN → aucun accès métier (IA-21).
 *
 * Stub en attendant l'ADR multi-tenant / RBAC (IA-05) : les rôles Keycloak
 * (realm_access.roles) ne sont pas encore interprétés, tout utilisateur
 * tenant est traité comme OPERATOR. Point d'extension : quand les rôles
 * seront disponibles, retourner `{}` pour ADMIN/AUDITOR (tout le tenant).
 */
export function resolveInvestigationCaseScope(
  user: AuthenticatedUser,
): InvestigationCaseScope {
  if (user.isSystemRealm) {
    throw new ForbiddenException(
      "Le realm système n'a pas accès aux données métier (IA-21)",
    );
  }
  return { operatorId: user.sub };
}
