import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class WithdrawReferencePrintCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly motive: string,
  ) {}
}
