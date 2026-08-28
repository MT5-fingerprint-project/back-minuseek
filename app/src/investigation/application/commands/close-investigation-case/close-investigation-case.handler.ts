import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import {
  FAMILIAR_PRINT_DESTRUCTION,
  FamiliarPrintDestructionPort,
} from '../../ports/familiar-print-destruction.port';
import { CloseInvestigationCaseCommand } from './close-investigation-case.command';

@CommandHandler(CloseInvestigationCaseCommand)
export class CloseInvestigationCaseHandler implements ICommandHandler<
  CloseInvestigationCaseCommand,
  void
> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
    @Inject(FAMILIAR_PRINT_DESTRUCTION)
    private readonly familiarPrints: FamiliarPrintDestructionPort,
  ) {}

  async execute(cmd: CloseInvestigationCaseCommand): Promise<void> {
    const investigationCase = await this.repo.findById(cmd.caseId);
    if (!investigationCase) throw new CaseNotFoundError(cmd.caseId);

    const previousStatus = investigationCase.status;

    // Détruire, puis clore : si la destruction échoue, la clôture n'a pas lieu,
    // le dossier reste ouvert et le technicien relance — la reprise ne traite
    // que ce qui reste. Rien ne ment. Sur un dossier déjà clos, la destruction
    // ne trouve rien et c'est `close()` qui refuse juste après.
    const destroyed = await this.familiarPrints.destroyForCase(
      cmd.caseId,
      cmd.actor,
    );
    investigationCase.close();

    await this.repo.save(investigationCase, {
      eventType: AuditEventTypeEnum.CASE_STATUS_CHANGED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: investigationCase.id,
      payload: {
        previousStatus,
        newStatus: investigationCase.status,
        reason: null,
        destroyedPrintCount: destroyed.destroyedCount,
      },
    });

    // Le refus d'écriture ne vaut qu'à partir du statut CLOSED : une empreinte
    // déposée entre les deux se rattrape ici, et sur un dossier normal cette
    // seconde passe ne trouve rien.
    await this.familiarPrints.destroyForCase(cmd.caseId, cmd.actor);
  }
}
