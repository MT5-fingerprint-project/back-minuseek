import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { RestoreTraceCommand } from './restore-trace.command';

@CommandHandler(RestoreTraceCommand)
export class RestoreTraceHandler implements ICommandHandler<
  RestoreTraceCommand,
  void
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
  ) {}

  async execute(cmd: RestoreTraceCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }

    // Le journal ne sérialise que des scalaires : la date part en ISO-8601.
    const withdrawnAt = trace.withdrawnAt?.toISOString() ?? null;
    trace.restore();

    await this.repo.save(trace, {
      eventType: AuditEventTypeEnum.TRACE_RESTORED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: trace.caseId,
      traceId: trace.id,
      payload: { withdrawnAt },
    });
  }
}
