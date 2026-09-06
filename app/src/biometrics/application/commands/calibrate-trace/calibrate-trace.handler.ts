import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { CalibrateTraceCommand } from './calibrate-trace.command';

@CommandHandler(CalibrateTraceCommand)
export class CalibrateTraceHandler implements ICommandHandler<CalibrateTraceCommand> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(cmd: CalibrateTraceCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }
    assertCaseAcceptsWork(
      trace.caseId,
      await this.caseStatus.findStatus(trace.caseId),
    );

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
