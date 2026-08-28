import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { ReopenInvestigationCaseCommand } from './reopen-investigation-case.command';

@CommandHandler(ReopenInvestigationCaseCommand)
export class ReopenInvestigationCaseHandler implements ICommandHandler<
  ReopenInvestigationCaseCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
  ) {}

  async execute(cmd: ReopenInvestigationCaseCommand): Promise<void> {
    const investigationCase = await this.repo.findById(cmd.caseId);
    if (!investigationCase) throw new CaseNotFoundError(cmd.caseId);

    const previousStatus = investigationCase.status;
    investigationCase.reopen();

    await this.repo.save(investigationCase, {
      eventType: AuditEventTypeEnum.CASE_STATUS_CHANGED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: investigationCase.id,
      payload: {
        previousStatus,
        newStatus: investigationCase.status,
        reason: cmd.reason,
      },
    });
  }
}
