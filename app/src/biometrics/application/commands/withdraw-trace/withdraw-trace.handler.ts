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
import { WithdrawTraceCommand } from './withdraw-trace.command';

@CommandHandler(WithdrawTraceCommand)
export class WithdrawTraceHandler implements ICommandHandler<
  WithdrawTraceCommand,
  void
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(cmd: WithdrawTraceCommand): Promise<void> {
    const trace = await this.repo.findById(cmd.id);
    if (!trace) {
      throw new TraceNotFoundError(cmd.id);
    }

    assertCaseAcceptsWork(
      trace.caseId,
      await this.caseStatus.findStatus(trace.caseId),
    );

    trace.withdraw(cmd.motive, new Date());

    // L'objet stocké n'est jamais détruit : l'empreinte inscrite au journal
    // continue de désigner des octets qui existent.
    await this.repo.save(trace, {
      eventType: AuditEventTypeEnum.TRACE_DELETED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: trace.caseId,
      traceId: trace.id,
      payload: {
        traceId: trace.id,
        storagePath: trace.path,
        fileSha256: trace.sha256,
        motive: cmd.motive,
      },
    });
  }
}
