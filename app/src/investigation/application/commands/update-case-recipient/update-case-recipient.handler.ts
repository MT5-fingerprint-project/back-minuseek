import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { UpdateCaseRecipientCommand } from './update-case-recipient.command';

@CommandHandler(UpdateCaseRecipientCommand)
export class UpdateCaseRecipientHandler implements ICommandHandler<
  UpdateCaseRecipientCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
  ) {}

  async execute(cmd: UpdateCaseRecipientCommand): Promise<void> {
    const investigationCase = await this.repo.findById(cmd.caseId);
    if (!investigationCase) throw new CaseNotFoundError(cmd.caseId);

    investigationCase.replaceRecipient(cmd.recipient);

    // À qui le rapport est adressé fait partie de ce qu'un registre d'actes a
    // vocation à établir : le `changes` porte les trois lignes avec leurs valeurs.
    await this.repo.save(investigationCase, {
      eventType: AuditEventTypeEnum.CASE_UPDATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: investigationCase.id,
      payload: { changes: investigationCase.recipient },
    });
  }
}
