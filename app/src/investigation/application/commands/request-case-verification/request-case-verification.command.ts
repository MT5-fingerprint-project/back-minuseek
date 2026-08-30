import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';

export interface VerificationRequester {
  id: string;
  role: UserRoleEnum;
}

export class RequestCaseVerificationCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requester: VerificationRequester,
    public readonly caseId: string,
    public readonly verifierUserId: string,
  ) {}
}
