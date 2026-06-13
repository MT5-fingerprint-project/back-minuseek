import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListLayersQuery } from './list-layers.query';
import { LAYER_READER, type LayerReader } from './layer.reader';
import type { LayerReadModel } from './layer-read-model';

@QueryHandler(ListLayersQuery)
export class ListLayersHandler implements IQueryHandler<
  ListLayersQuery,
  LayerReadModel[]
> {
  constructor(@Inject(LAYER_READER) private readonly reader: LayerReader) {}

  execute(query: ListLayersQuery): Promise<LayerReadModel[]> {
    return this.reader.findByFingerprintId(query.fingerprintId);
  }
}
