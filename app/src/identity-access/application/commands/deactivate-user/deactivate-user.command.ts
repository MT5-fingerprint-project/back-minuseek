import { ServiceAccountAdministrator } from '../../service-account-administrator';

export class DeactivateUserCommand {
  constructor(
    public readonly requester: ServiceAccountAdministrator,
    public readonly targetUserId: string,
  ) {}
}
