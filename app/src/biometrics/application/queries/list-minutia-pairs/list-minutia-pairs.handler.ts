import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { numberMinutiaPairs } from '../../../../shared/domain/forensics/minutia-pairing';
import { ListMinutiaPairsQuery } from './list-minutia-pairs.query';
import {
  MINUTIA_PAIR_READER,
  type MinutiaPairReader,
} from './minutia-pair.reader';
import type { MinutiaPairReadModel } from './minutia-pair-read-model';

@QueryHandler(ListMinutiaPairsQuery)
export class ListMinutiaPairsHandler implements IQueryHandler<
  ListMinutiaPairsQuery,
  MinutiaPairReadModel[]
> {
  constructor(
    @Inject(MINUTIA_PAIR_READER) private readonly reader: MinutiaPairReader,
  ) {}

  async execute(query: ListMinutiaPairsQuery): Promise<MinutiaPairReadModel[]> {
    const rows = await this.reader.findByTraceAndReferencePrint(
      query.traceId,
      query.referencePrintId,
      query.blindVerifierUserId,
    );
    return numberMinutiaPairs(rows).map((row) => ({
      id: row.id,
      number: row.number,
      traceMinutiaLayerId: row.traceMinutiaLayerId,
      referenceMinutiaLayerId: row.referenceMinutiaLayerId,
      minutiaType: row.minutiaType,
    }));
  }
}
