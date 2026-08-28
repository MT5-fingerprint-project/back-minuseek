import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  PUBLIC_SEAL_READER,
  type PublicSealReader,
} from '../../ports/public-seal.reader';
import { FindSealQuery } from './find-seal.query';
import { PublicSealReadModel } from './public-seal-read-model';

@QueryHandler(FindSealQuery)
export class FindSealHandler implements IQueryHandler<FindSealQuery> {
  constructor(
    @Inject(PUBLIC_SEAL_READER)
    private readonly reader: PublicSealReader,
  ) {}

  async execute(query: FindSealQuery): Promise<PublicSealReadModel | null> {
    const laboratory = await this.reader.findLaboratoryName(query.tenantSlug);
    if (laboratory === null) {
      return null;
    }

    const seal = await this.reader.findSeal(query.tenantSlug, query.sha256);
    if (seal === null) {
      return null;
    }

    const neighbours =
      seal.kind === 'REPORT' && seal.caseId !== null && seal.reportType !== null
        ? await this.reader.reportNeighbours(
            query.tenantSlug,
            seal.caseId,
            seal.reportType,
            seal.sealedAt,
          )
        : { hasEarlier: false, hasLater: false };

    return {
      known: true,
      kind: seal.kind,
      laboratory,
      sealedAt: seal.sealedAt,
      anchoredAt: seal.anchoredAt,
      precededByEarlierReport: neighbours.hasEarlier,
      supersededByNewerReport: neighbours.hasLater,
    };
  }
}
