import { HitReadModel } from '../../application/queries/list-hits/hit-read-model';
import type { HitReader } from '../../application/queries/list-hits/hit.reader';

export interface HitFixture extends HitReadModel {
  declaredByUserId: string | null;
}

export class InMemoryHitReader implements HitReader {
  constructor(private readonly hits: HitFixture[] = []) {}

  findByTraceId(
    traceId: string,
    declaredBy?: string | null,
  ): Promise<HitReadModel[]> {
    return Promise.resolve(
      this.hits
        .filter(
          (hit) =>
            hit.traceId === traceId &&
            (declaredBy == null || hit.declaredByUserId === declaredBy),
        )
        .map(({ traceId: onTrace, referencePrintId }) => ({
          traceId: onTrace,
          referencePrintId,
        })),
    );
  }
}
