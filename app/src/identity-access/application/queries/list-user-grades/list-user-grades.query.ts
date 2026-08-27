import { ServiceAccountAdministrator } from '../../service-account-administrator';

export class ListUserGradesQuery {
  constructor(
    public readonly requester: ServiceAccountAdministrator | null = null,
  ) {}
}
