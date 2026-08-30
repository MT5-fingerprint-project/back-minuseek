import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CaseNotUnderExpertiseError } from '../../../domain/case-expertise/errors/case-not-under-expertise.error';
import {
  CASE_EXPERTISE_REPOSITORY,
  CaseExpertiseRepository,
} from '../../../domain/case-expertise/repository/case-expertise.repository';
import { saisinePayload } from '../../../domain/case-expertise/saisine-payload';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { UpdateCaseSaisineCommand } from './update-case-saisine.command';

@CommandHandler(UpdateCaseSaisineCommand)
export class UpdateCaseSaisineHandler implements ICommandHandler<
  UpdateCaseSaisineCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly cases: InvestigationCaseRepository,
    @Inject(CASE_EXPERTISE_REPOSITORY)
    private readonly expertises: CaseExpertiseRepository,
  ) {}

  async execute(command: UpdateCaseSaisineCommand): Promise<void> {
    const investigationCase = await this.cases.findById(command.caseId);
    if (
      !investigationCase ||
      investigationCase.operatorUserId !== command.requesterUserId
    ) {
      throw new CaseNotFoundError(command.caseId);
    }

    const expertise = await this.expertises.findByCaseId(command.caseId);
    if (!expertise) throw new CaseNotUnderExpertiseError(command.caseId);

    const changes = expertise.completeSaisine(command.saisine);
    if (Object.keys(changes).length === 0) return;

    await this.expertises.save(expertise, {
      eventType: AuditEventTypeEnum.CASE_SAISINE_UPDATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: command.caseId,
      payload: { changes: saisinePayload(changes) },
    });
  }
}
