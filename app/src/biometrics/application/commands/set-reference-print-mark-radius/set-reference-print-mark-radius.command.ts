import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class SetReferencePrintMarkRadiusCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly markRadius: number,
  ) {}
}
