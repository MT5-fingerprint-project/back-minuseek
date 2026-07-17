import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Matching,
  MatchingPrimitives,
} from '../../../domain/matching/entity/matching';
import {
  MATCHING_REPOSITORY,
  MatchingRepository,
} from '../../../domain/matching/repository/matching.repository';
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
import {
  FINGERPRINT_MATCHER,
  FingerprintMatcherPort,
} from '../../ports/fingerprint-matcher.port';
import { CompareTraceCommand } from './compare-trace.command';

@CommandHandler(CompareTraceCommand)
export class CompareTraceHandler implements ICommandHandler<
  CompareTraceCommand,
  MatchingPrimitives[]
> {
  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly traceRepo: TraceRepository,
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly referencePrintRepo: ReferencePrintRepository,
    @Inject(FINGERPRINT_MATCHER)
    private readonly matcher: FingerprintMatcherPort,
    @Inject(MATCHING_REPOSITORY)
    private readonly matchingRepo: MatchingRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: CompareTraceCommand): Promise<MatchingPrimitives[]> {
    const trace = await this.traceRepo.findById(cmd.traceId);
    if (!trace || trace.caseId !== cmd.caseId) {
      throw new TraceNotFoundError(cmd.traceId);
    }

    const referencePrints = await Promise.all(
      cmd.referencePrintIds.map((id) => this.referencePrintRepo.findById(id)),
    );
    referencePrints.forEach((referencePrint, index) => {
      if (!referencePrint || referencePrint.caseId !== cmd.caseId) {
        throw new ReferencePrintNotFoundError(cmd.referencePrintIds[index]);
      }
    });

    const candidates = await this.matcher.compare({
      caseId: cmd.caseId,
      traceId: cmd.traceId,
      referencePrintIds: cmd.referencePrintIds,
    });

    const requestedIds = new Set(cmd.referencePrintIds);
    const matchings = candidates
      .filter((candidate) => requestedIds.has(candidate.referencePrintId))
      .map((candidate) =>
        Matching.create({
          id: this.idGenerator.generate(),
          traceId: cmd.traceId,
          referencePrintId: candidate.referencePrintId,
          score: candidate.score,
        }),
      );

    await this.matchingRepo.upsertMany(matchings);

    return matchings.map((matching) => matching.toPrimitives());
  }
}
