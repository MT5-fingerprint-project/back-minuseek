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
import { RemoveHitCommand } from './remove-hit.command';

@CommandHandler(RemoveHitCommand)
export class RemoveHitHandler
  implements ICommandHandler<RemoveHitCommand, void>
{
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly traceRepo: TraceRepository,
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly referencePrintRepo: ReferencePrintRepository,
    @Inject(HIT_REPOSITORY)
    private readonly hitRepo: HitRepository,
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

    await this.hitRepo.deleteByPair(cmd.traceId, cmd.referencePrintId);
  }
}
