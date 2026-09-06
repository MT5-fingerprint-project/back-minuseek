import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { MarkRadius } from '../../../domain/mark-radius.vo';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { SetReferencePrintMarkRadiusCommand } from './set-reference-print-mark-radius.command';

@CommandHandler(SetReferencePrintMarkRadiusCommand)
export class SetReferencePrintMarkRadiusHandler implements ICommandHandler<SetReferencePrintMarkRadiusCommand> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(cmd: SetReferencePrintMarkRadiusCommand): Promise<void> {
    const rp = await this.repo.findById(cmd.id);
    if (!rp) {
      throw new ReferencePrintNotFoundError(cmd.id);
    }
    assertCaseAcceptsWork(
      rp.caseId,
      await this.caseStatus.findStatus(rp.caseId),
    );

    const previousMarkRadius = rp.markRadius;
    rp.setMarkRadius(MarkRadius.of(cmd.markRadius));

    await this.repo.save(rp, {
      eventType: AuditEventTypeEnum.MARK_RADIUS_SET,
      evidenceClass: EvidenceClassEnum.DECLARED,
      actor: cmd.actor,
      caseId: rp.caseId,
      payload: {
        fingerprintId: rp.id,
        markRadius: rp.markRadius,
        previousMarkRadius,
      },
    });
  }
}
