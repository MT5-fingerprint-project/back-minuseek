import { UserRoleEnum } from '../domain/user/value-objects/user-role.vo';

/** L'appelant, tel que les commandes et les lectures de l'annuaire ont besoin
 * de le connaître. `null` quand le jeton n'a pas encore de ligne en base. */
export interface ServiceAccountAdministrator {
  id: string;
  role: UserRoleEnum;
}
