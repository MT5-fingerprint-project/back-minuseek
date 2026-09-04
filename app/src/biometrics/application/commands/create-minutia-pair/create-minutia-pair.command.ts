import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class CreateMinutiaPairCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly traceId: string,
    public readonly referencePrintId: string,
    public readonly traceMinutiaLayerId: string,
    public readonly referenceMinutiaLayerId: string,
    public readonly createdByUserId: string | null = null,
    public readonly blindVerifierUserId: string | null = null,
  ) {}
}
