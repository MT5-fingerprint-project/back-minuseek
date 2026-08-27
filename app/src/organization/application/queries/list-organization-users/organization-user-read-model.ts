import type { TenantUser } from '../../ports/identity-provider.port';

/**
 * Le compte tel que l'écran d'administration le lit : l'identité vient du
 * fournisseur d'identité, le rôle de la base du service. Un modèle propre à
 * cette requête, pour ne pas poser `role` sur le `TenantUser` du port
 * d'identité, qui décrit Keycloak et pas le métier.
 */
export interface OrganizationUserReadModel extends TenantUser {
  /** `null` quand le compte existe chez le fournisseur d'identité sans ligne
   * dans la base du service. */
  role: string | null;
}
