import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';

export class GetServiceActivityQuery {
  constructor(
    public readonly requester: { id: string; role: UserRoleEnum },
    public readonly operatorUserId?: string,
  ) {}
}
