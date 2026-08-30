import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class WithdrawTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly motive: string,
    public readonly motiveDetail: string | null = null,
  ) {}
}
