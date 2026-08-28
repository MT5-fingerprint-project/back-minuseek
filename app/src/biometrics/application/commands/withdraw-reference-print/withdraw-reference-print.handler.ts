import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { WithdrawReferencePrintCommand } from './withdraw-reference-print.command';

@CommandHandler(WithdrawReferencePrintCommand)
export class WithdrawReferencePrintHandler implements ICommandHandler<
  WithdrawReferencePrintCommand,
  void
> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(cmd: WithdrawReferencePrintCommand): Promise<void> {
    const referencePrint = await this.repo.findById(cmd.id);
    if (!referencePrint) {
      throw new ReferencePrintNotFoundError(cmd.id);
    }

    assertCaseAcceptsWork(
      referencePrint.caseId,
      await this.caseStatus.findStatus(referencePrint.caseId),
    );

    referencePrint.withdraw(cmd.motive, new Date());

    await this.repo.save(referencePrint, {
      eventType: AuditEventTypeEnum.REFERENCE_PRINT_DELETED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: referencePrint.caseId,
      payload: {
        referencePrintId: referencePrint.id,
        storagePath: referencePrint.path,
        fileSha256: referencePrint.sha256,
        motive: cmd.motive,
      },
    });
  }
}
