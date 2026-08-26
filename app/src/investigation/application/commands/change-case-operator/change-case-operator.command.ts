import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';

export interface OperatorChangeRequester {
  id: string;
  role: UserRoleEnum;
}

export class ChangeCaseOperatorCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requester: OperatorChangeRequester,
    public readonly caseId: string,
    public readonly newOperatorUserId: string,
  ) {}
}
