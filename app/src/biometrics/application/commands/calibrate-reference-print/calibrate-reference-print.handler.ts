import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CalibrateReferencePrintCommand } from './calibrate-reference-print.command';

@CommandHandler(CalibrateReferencePrintCommand)
export class CalibrateReferencePrintHandler implements ICommandHandler<CalibrateReferencePrintCommand> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
  ) {}

  async execute(cmd: CalibrateReferencePrintCommand): Promise<void> {
    const rp = await this.repo.findById(cmd.id);
    if (!rp) {
      throw new ReferencePrintNotFoundError(cmd.id);
    }

    const previousResolutionDpi = rp.resolutionDpi;
    rp.calibrate(cmd.resolutionDpi);

    await this.repo.save(rp, {
      eventType: AuditEventTypeEnum.REFERENCE_PRINT_CALIBRATED,
      evidenceClass: EvidenceClassEnum.DECLARED,
      actor: cmd.actor,
      caseId: rp.caseId,
      payload: {
        referencePrintId: rp.id,
        resolutionDpi: rp.resolutionDpi,
        previousResolutionDpi,
      },
    });
  }
}
