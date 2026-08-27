import { UserProfileCorrection } from '../../../domain/user/entity/user';
import { ServiceAccountAdministrator } from '../../service-account-administrator';

export class CorrectUserProfileCommand {
  constructor(
    public readonly requester: ServiceAccountAdministrator,
    public readonly targetUserId: string,
    public readonly correction: UserProfileCorrection,
  ) {}
}
