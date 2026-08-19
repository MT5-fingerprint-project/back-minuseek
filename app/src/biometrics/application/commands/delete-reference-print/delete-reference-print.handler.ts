import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  AUDIT_TRAIL,
  AuditTrailPort,
} from '../../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { archivedOriginalPath } from '../../services/displayable-image';
import { DeleteReferencePrintCommand } from './delete-reference-print.command';

@CommandHandler(DeleteReferencePrintCommand)
export class DeleteReferencePrintHandler implements ICommandHandler<
  DeleteReferencePrintCommand,
  void
> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async execute(cmd: DeleteReferencePrintCommand): Promise<void> {
    const referencePrint = await this.repo.findById(cmd.id);
    if (!referencePrint) {
      throw new ReferencePrintNotFoundError(cmd.id);
    }

    await this.transactionRunner.run(async () => {
      await this.repo.delete(cmd.id);
      await this.auditTrail.append({
        eventType: AuditEventTypeEnum.REFERENCE_PRINT_DELETED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: referencePrint.caseId,
        payload: {
          referencePrintId: referencePrint.id,
          storagePath: referencePrint.path,
          fileSha256: referencePrint.sha256,
          reason: cmd.reason,
        },
      });
    });

    await this.storage.delete(referencePrint.path);
    const archived = archivedOriginalPath(referencePrint.path);
    if (archived) {
      await this.storage.delete(archived);
    }
  }
}
