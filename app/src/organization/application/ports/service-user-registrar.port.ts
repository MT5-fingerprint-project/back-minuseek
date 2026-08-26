export const SERVICE_USER_REGISTRAR = Symbol('SERVICE_USER_REGISTRAR');

export interface ServiceUserToRegister {
  organizationSlug: string;
  identityProviderId: string;
  role: string;
  grade: string;
  serviceNumber: string;
  firstName: string;
  lastName: string;
}

/** Écrit le compte dans la base du service. Le control-plane n'a pas de tenant
 * courant : l'adapter ouvre la base à partir du slug. */
export interface ServiceUserRegistrarPort {
  register(user: ServiceUserToRegister): Promise<void>;
}
