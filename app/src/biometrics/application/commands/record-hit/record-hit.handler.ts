import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Hit } from '../../../domain/hit/entity/hit';
import {
  HIT_REPOSITORY,
  HitRepository,
} from '../../../domain/hit/repository/hit.repository';
import {
  LAYER_REPOSITORY,
  LayerRepository,
} from '../../../domain/layer/repository/layer.repository';
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
import { ReferencePrintImageDestroyedError } from '../../../domain/reference-print/errors/reference-print-image-destroyed.error';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { REQUIRED_MINUTIAE } from '../../../domain/hit/hit-rules';
import {
  MATCHING_REPOSITORY,
  MatchingRepository,
} from '../../../domain/matching/repository/matching.repository';
import { RecordHitCommand } from './record-hit.command';

@CommandHandler(RecordHitCommand)
export class RecordHitHandler implements ICommandHandler<
  RecordHitCommand,
  void
> {
  constructor(
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
    @Inject(TRACE_REPOSITORY)
    private readonly traceRepo: TraceRepository,
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly referencePrintRepo: ReferencePrintRepository,
    @Inject(LAYER_REPOSITORY)
    private readonly layerRepo: LayerRepository,
    @Inject(HIT_REPOSITORY)
    private readonly hitRepo: HitRepository,
    @Inject(MATCHING_REPOSITORY)
    private readonly matchingRepo: MatchingRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: RecordHitCommand): Promise<void> {
    const trace = await this.traceRepo.findById(cmd.traceId);
    if (!trace || trace.caseId !== cmd.caseId || trace.isWithdrawn) {
      throw new TraceNotFoundError(cmd.traceId);
    }

    const referencePrint = await this.referencePrintRepo.findById(
      cmd.referencePrintId,
    );
    if (
      !referencePrint ||
      referencePrint.caseId !== cmd.caseId ||
      referencePrint.isWithdrawn
    ) {
      throw new ReferencePrintNotFoundError(cmd.referencePrintId);
    }
    if (referencePrint.isImageDestroyed) {
      throw new ReferencePrintImageDestroyedError(referencePrint.id);
    }

    assertCaseAcceptsWork(
      cmd.caseId,
      await this.caseStatus.findStatus(cmd.caseId),
    );

    const [traceMinutiae, referenceMinutiae] = await Promise.all([
      this.layerRepo.countMinutiae(cmd.traceId),
      this.layerRepo.countMinutiae(cmd.referencePrintId),
    ]);
    const hit = Hit.record({
      id: this.idGenerator.generate(),
      traceId: cmd.traceId,
      referencePrintId: cmd.referencePrintId,
      declaredByUserId: cmd.declaredByUserId,
      traceMinutiae,
      referenceMinutiae,
    });

    const matchings = await this.matchingRepo.findByTraceId(cmd.traceId);
    const score = matchings
      .map((matching) => matching.toPrimitives())
      .find(
        (matching) => matching.referencePrintId === cmd.referencePrintId,
      )?.score;

    await this.hitRepo.save(hit, {
      eventType: AuditEventTypeEnum.HIT_RECORDED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: cmd.actor,
      caseId: cmd.caseId,
      traceId: cmd.traceId,
      payload: {
        traceId: cmd.traceId,
        referencePrintId: cmd.referencePrintId,
        score: score ?? null,
        traceMinutiae,
        referenceMinutiae,
        requiredMinutiae: REQUIRED_MINUTIAE,
      },
    });
  }
}
