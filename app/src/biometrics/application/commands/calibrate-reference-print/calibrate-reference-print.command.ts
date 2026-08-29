import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class CalibrateReferencePrintCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly resolutionDpi: number,
  ) {}
}
