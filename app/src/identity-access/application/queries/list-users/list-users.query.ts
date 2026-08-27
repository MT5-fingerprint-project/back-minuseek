import { ServiceAccountAdministrator } from '../../service-account-administrator';
import { ServiceUsersFilters } from './service-users-filters';

export class ListUsersQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
    public readonly filters: ServiceUsersFilters = {},
    /** `null` quand le jeton n'a pas de compte de service : l'annuaire lui est
     * refusé, comme à tout compte qui n'est pas responsable. */
    public readonly requester: ServiceAccountAdministrator | null = null,
  ) {}
}
