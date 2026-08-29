import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CalibrateTraceCommand } from './calibrate-trace.command';

@CommandHandler(CalibrateTraceCommand)
export class CalibrateTraceHandler implements ICommandHandler<CalibrateTraceCommand> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
  ) {}

  async execute(cmd: CalibrateTraceCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }

    const previousResolutionDpi = trace.resolutionDpi;
    trace.calibrate(cmd.resolutionDpi);

    await this.repo.save(trace, {
      eventType: AuditEventTypeEnum.TRACE_CALIBRATED,
      evidenceClass: EvidenceClassEnum.DECLARED,
      actor: cmd.actor,
      caseId: trace.caseId,
      traceId: trace.id,
      payload: {
        resolutionDpi: trace.resolutionDpi,
        previousResolutionDpi,
      },
    });
  }
}
