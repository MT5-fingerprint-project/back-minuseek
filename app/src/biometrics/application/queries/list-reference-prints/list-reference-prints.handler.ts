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

type ReferencePrintView = ReferencePrintReadModel & { url: string | null };

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
    const referencePrints = await this.reader.findByCaseId(
      query.caseId,
      query.withdrawn,
    );
    const data = await Promise.all(
      referencePrints.map(async (referencePrint) => ({
        ...referencePrint,
        // Une URL signée se fabrique sans erreur sur un objet supprimé : le
        // front afficherait une image cassée au lieu d'une explication.
        url:
          referencePrint.imageDestroyedAt === null
            ? await this.storage.getUrl(referencePrint.path)
            : null,
      })),
    );
    return { data };
  }
}
