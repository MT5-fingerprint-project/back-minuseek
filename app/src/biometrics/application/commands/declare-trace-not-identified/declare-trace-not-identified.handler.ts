import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { DeclareTraceNotIdentifiedCommand } from './declare-trace-not-identified.command';

@CommandHandler(DeclareTraceNotIdentifiedCommand)
export class DeclareTraceNotIdentifiedHandler implements ICommandHandler<DeclareTraceNotIdentifiedCommand> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(cmd: DeclareTraceNotIdentifiedCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }

    assertCaseAcceptsWork(
      trace.caseId,
      await this.caseStatus.findStatus(trace.caseId),
    );

    trace.declareNotIdentified(new Date());

    await this.repo.save(trace, {
      eventType: AuditEventTypeEnum.TRACE_NOT_IDENTIFIED,
      evidenceClass: EvidenceClassEnum.DECLARED,
      actor: cmd.actor,
      caseId: trace.caseId,
      traceId: trace.id,
      payload: { notIdentified: true },
    });
  }
}
