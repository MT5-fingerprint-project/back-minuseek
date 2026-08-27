export const SERVICE_USER_ROLES = Symbol('SERVICE_USER_ROLES');

export interface ServiceUserRole {
  identityProviderId: string;
  role: string;
}

/** Le fournisseur d'identité ne connaît que l'identité : le rôle vit dans la
 * base du service, sur la ligne dont `identityProviderId` porte l'identifiant du
 * compte. Le control-plane n'a pas de tenant courant, l'adapter ouvre donc la
 * base à partir du slug — comme le registrar le fait en écriture. */
export interface ServiceUserRolesPort {
  findRolesOf(
    organizationSlug: string,
    identityProviderIds: string[],
  ): Promise<ServiceUserRole[]>;
}
