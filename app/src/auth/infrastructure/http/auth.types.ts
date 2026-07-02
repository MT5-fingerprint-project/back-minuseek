/**
 * Claims d'un access token Keycloak validé, retournés par la JwtStrategy et
 * attachés à `request.user`.
 *
 * Le claim `iss` (issuer = realm) identifie le tenant — point d'ancrage du
 * multitenant à venir (cf. docs/multitenancy.md).
 */
export interface AuthenticatedUser {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  [claim: string]: unknown;
}
