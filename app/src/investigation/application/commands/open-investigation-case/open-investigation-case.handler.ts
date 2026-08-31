import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { anchorChainSafely } from '../../../../shared/application/anchor-chain-safely';
import {
  CHAIN_ANCHORING,
  type ChainAnchoringPort,
} from '../../../../shared/domain/ports/chain-anchoring.port';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { CaseNumberAlreadyExistsError } from '../../../domain/investigation-case/errors/case-number-already-exists.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';

@CommandHandler(OpenInvestigationCaseCommand)
export class OpenInvestigationCaseHandler implements ICommandHandler<
  OpenInvestigationCaseCommand,
  string
> {
  private readonly logger = new Logger(OpenInvestigationCaseHandler.name);

  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(CHAIN_ANCHORING)
    private readonly anchoring: ChainAnchoringPort,
  ) {}

  async execute(cmd: OpenInvestigationCaseCommand): Promise<string> {
    const exists = await this.repo.existsByCaseNumber(cmd.caseNumber);
    if (exists) throw new CaseNumberAlreadyExistsError(cmd.caseNumber);

    const id = this.idGenerator.generate();
    const newCase = InvestigationCase.open({
      id,
      caseNumber: cmd.caseNumber,
      pvNumber: cmd.pvNumber,
      description: cmd.description,
      operatorUserId: cmd.operatorUserId,
    });
    await this.repo.save(newCase, {
      eventType: AuditEventTypeEnum.CASE_OPENED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: id,
      payload: {
        caseNumber: cmd.caseNumber,
        pvNumber: cmd.pvNumber,
        operatorUserId: cmd.operatorUserId,
      },
    });
    await anchorChainSafely(this.anchoring, this.logger);
    return id;
  }
}
