import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  FINGERPRINT_LOCATOR,
  type FingerprintLocatorPort,
} from '../../ports/fingerprint-locator.port';
import { ListLayersQuery } from './list-layers.query';
import { LAYER_READER, type LayerReader } from './layer.reader';
import type { LayerReadModel } from './layer-read-model';

@QueryHandler(ListLayersQuery)
export class ListLayersHandler implements IQueryHandler<
  ListLayersQuery,
  LayerReadModel[]
> {
  constructor(
    @Inject(LAYER_READER) private readonly reader: LayerReader,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly locator: FingerprintLocatorPort,
  ) {}

  async execute(query: ListLayersQuery): Promise<LayerReadModel[]> {
    const location = await this.locator.locate(query.fingerprintId);
    if (!location) {
      return [];
    }
    return this.reader.findByFingerprintId(
      query.fingerprintId,
      query.blindVerifierUserId,
    );
  }
}
