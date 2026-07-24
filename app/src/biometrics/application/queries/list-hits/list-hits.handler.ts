import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { HIT_READER, HitReader } from './hit.reader';
import { ListHitsQuery } from './list-hits.query';

@QueryHandler(ListHitsQuery)
export class ListHitsHandler implements IQueryHandler<ListHitsQuery> {
  constructor(
    @Inject(HIT_READER)
    private readonly reader: HitReader,
  ) {}

  async execute(query: ListHitsQuery): Promise<{ referencePrintIds: string[] }> {
    const hits = await this.reader.findByTraceId(query.traceId);
    return { referencePrintIds: hits.map((hit) => hit.referencePrintId) };
  }
}
