import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  HIT_REPOSITORY,
  HitRepository,
} from '../../../domain/hit/repository/hit.repository';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  AUDIT_TRAIL,
  type AuditTrailPort,
} from '../../../../shared/domain/ports/audit-trail.port';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { RemoveHitCommand } from './remove-hit.command';

@CommandHandler(RemoveHitCommand)
export class RemoveHitHandler implements ICommandHandler<
  RemoveHitCommand,
  void
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly traceRepo: TraceRepository,
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly referencePrintRepo: ReferencePrintRepository,
    @Inject(HIT_REPOSITORY)
    private readonly hitRepo: HitRepository,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async execute(cmd: RemoveHitCommand): Promise<void> {
    const trace = await this.traceRepo.findById(cmd.traceId);
    if (!trace || trace.caseId !== cmd.caseId) {
      throw new TraceNotFoundError(cmd.traceId);
    }

    const referencePrint = await this.referencePrintRepo.findById(
      cmd.referencePrintId,
    );
    if (!referencePrint || referencePrint.caseId !== cmd.caseId) {
      throw new ReferencePrintNotFoundError(cmd.referencePrintId);
    }

    await this.transactionRunner.run(async () => {
      await this.hitRepo.deleteByPair(cmd.traceId, cmd.referencePrintId);
      await this.auditTrail.append({
        eventType: AuditEventTypeEnum.HIT_REMOVED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: cmd.caseId,
        traceId: cmd.traceId,
        payload: {
          traceId: cmd.traceId,
          referencePrintId: cmd.referencePrintId,
        },
      });
    });
  }
}
