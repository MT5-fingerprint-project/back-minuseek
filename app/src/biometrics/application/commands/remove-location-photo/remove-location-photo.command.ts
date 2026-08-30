import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { WithdrawalMotiveEnum } from '../../../domain/withdrawal/withdrawal.vo';

export class RemoveLocationPhotoCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly traceId: string,
    public readonly motive: WithdrawalMotiveEnum,
  ) {}
}
