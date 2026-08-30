import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class DeleteLayerCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly verifierUserId: string | null = null,
  ) {}
}
