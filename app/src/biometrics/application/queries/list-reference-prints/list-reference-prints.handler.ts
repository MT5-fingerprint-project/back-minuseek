import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ReferencePrintReadModel } from './reference-print-read-model';
import {
  REFERENCE_PRINT_READER,
  ReferencePrintReader,
} from './reference-print.reader';
import { ListReferencePrintsQuery } from './list-reference-prints.query';

@QueryHandler(ListReferencePrintsQuery)
export class ListReferencePrintsHandler implements IQueryHandler<ListReferencePrintsQuery> {
  constructor(
    @Inject(REFERENCE_PRINT_READER)
    private readonly reader: ReferencePrintReader,
  ) {}

  async execute(
    query: ListReferencePrintsQuery,
  ): Promise<{ data: ReferencePrintReadModel[] }> {
    const data = await this.reader.findByCaseId(query.caseId);
    return { data };
  }
}
