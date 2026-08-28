import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { RestoreReferencePrintCommand } from './restore-reference-print.command';

@CommandHandler(RestoreReferencePrintCommand)
export class RestoreReferencePrintHandler implements ICommandHandler<
  RestoreReferencePrintCommand,
  void
> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
  ) {}

  async execute(cmd: RestoreReferencePrintCommand): Promise<void> {
    const referencePrint = await this.repo.findById(cmd.id);
    if (!referencePrint) {
      throw new ReferencePrintNotFoundError(cmd.id);
    }

    // Le journal ne sérialise que des scalaires : la date part en ISO-8601.
    const withdrawnAt = referencePrint.withdrawnAt?.toISOString() ?? null;
    referencePrint.restore();

    await this.repo.save(referencePrint, {
      eventType: AuditEventTypeEnum.REFERENCE_PRINT_RESTORED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: referencePrint.caseId,
      payload: { withdrawnAt },
    });
  }
}
