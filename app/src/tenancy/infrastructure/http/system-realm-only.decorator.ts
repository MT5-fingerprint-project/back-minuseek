import { SetMetadata } from '@nestjs/common';

export const SYSTEM_REALM_ONLY_KEY = 'systemRealmOnly';

/**
 * Ouvre une route au control-plane : SEUL un token du realm système
 * (KEYCLOAK_SYSTEM_REALM) y accède, et aucun contexte tenant n'est posé —
 * le superadmin ne peut atteindre aucune donnée métier (IA-12).
 *
 * L'autorisation est un mécanisme transverse, pas un bounded context :
 * ce décorateur se pose sur les controllers du contexte organization
 * (POST /organizations…), jamais sur une route métier.
 */
export const SystemRealmOnly = () => SetMetadata(SYSTEM_REALM_ONLY_KEY, true);
