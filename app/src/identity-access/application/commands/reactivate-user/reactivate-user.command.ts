import { ServiceAccountAdministrator } from '../../service-account-administrator';

export class ReactivateUserCommand {
  constructor(
    public readonly requester: ServiceAccountAdministrator,
    public readonly targetUserId: string,
  ) {}
}
