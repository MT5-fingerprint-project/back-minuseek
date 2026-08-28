import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { CaseExpertise } from '../../../domain/case-expertise/entity/case-expertise';
import { CaseAlreadyUnderExpertiseError } from '../../../domain/case-expertise/errors/case-already-under-expertise.error';
import {
  CASE_EXPERTISE_REPOSITORY,
  CaseExpertiseRepository,
} from '../../../domain/case-expertise/repository/case-expertise.repository';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { DeclareCaseExpertiseCommand } from './declare-case-expertise.command';

@CommandHandler(DeclareCaseExpertiseCommand)
export class DeclareCaseExpertiseHandler implements ICommandHandler<
  DeclareCaseExpertiseCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly cases: InvestigationCaseRepository,
    @Inject(CASE_EXPERTISE_REPOSITORY)
    private readonly expertises: CaseExpertiseRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(command: DeclareCaseExpertiseCommand): Promise<void> {
    const investigationCase = await this.cases.findById(command.caseId);
    if (
      !investigationCase ||
      investigationCase.operatorUserId !== command.requesterUserId
    ) {
      throw new CaseNotFoundError(command.caseId);
    }

    if (await this.expertises.existsForCase(command.caseId)) {
      throw new CaseAlreadyUnderExpertiseError(command.caseId);
    }

    const expertise = CaseExpertise.declare({
      id: this.idGenerator.generate(),
      caseId: command.caseId,
      expertUserId: command.requesterUserId,
      oathStatement: command.oathStatement,
      courtReference: command.courtReference,
    });
    const { oathStatement, courtReference, swornAt } = expertise.toPrimitives();

    await this.expertises.save(expertise, {
      eventType: AuditEventTypeEnum.CASE_EXPERTISE_DECLARED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: command.caseId,
      payload: {
        courtReference,
        swornAt: swornAt.toISOString(),
        oathStatement,
      },
    });
  }
}
