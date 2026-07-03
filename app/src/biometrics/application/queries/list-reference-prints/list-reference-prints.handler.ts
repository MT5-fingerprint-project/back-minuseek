import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { ReferencePrintReadModel } from './reference-print-read-model';
import {
  REFERENCE_PRINT_READER,
  ReferencePrintReader,
} from './reference-print.reader';
import { ListReferencePrintsQuery } from './list-reference-prints.query';

type ReferencePrintView = ReferencePrintReadModel & { url: string };

@QueryHandler(ListReferencePrintsQuery)
export class ListReferencePrintsHandler implements IQueryHandler<ListReferencePrintsQuery> {
  constructor(
    @Inject(REFERENCE_PRINT_READER)
    private readonly reader: ReferencePrintReader,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(
    query: ListReferencePrintsQuery,
  ): Promise<{ data: ReferencePrintView[] }> {
    const referencePrints = await this.reader.findByCaseId(query.caseId);
    const data = await Promise.all(
      referencePrints.map(async (referencePrint) => ({
        ...referencePrint,
        url: await this.storage.getUrl(referencePrint.path),
      })),
    );
    return { data };
  }
}
