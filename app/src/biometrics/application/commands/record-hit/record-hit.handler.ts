import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Hit } from '../../../domain/hit/entity/hit';
import {
  HIT_REPOSITORY,
  HitRepository,
} from '../../../domain/hit/repository/hit.repository';
import { assertEnoughMinutiae } from '../../../domain/hit/hit-rules';
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
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { RecordHitCommand } from './record-hit.command';

@CommandHandler(RecordHitCommand)
export class RecordHitHandler
  implements ICommandHandler<RecordHitCommand, void>
{
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly traceRepo: TraceRepository,
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly referencePrintRepo: ReferencePrintRepository,
    @Inject(LAYER_REPOSITORY)
    private readonly layerRepo: LayerRepository,
    @Inject(HIT_REPOSITORY)
    private readonly hitRepo: HitRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: RecordHitCommand): Promise<void> {
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

    const [traceMinutiae, referenceMinutiae] = await Promise.all([
      this.layerRepo.countMinutiae(cmd.traceId),
      this.layerRepo.countMinutiae(cmd.referencePrintId),
    ]);
    assertEnoughMinutiae(traceMinutiae, referenceMinutiae);

    const hit = Hit.create({
      id: this.idGenerator.generate(),
      traceId: cmd.traceId,
      referencePrintId: cmd.referencePrintId,
      declaredByUserId: cmd.declaredByUserId,
    });
    await this.hitRepo.save(hit);
  }
}
