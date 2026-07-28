import type { Hit } from '../entity/hit';

export const HIT_REPOSITORY = Symbol('HIT_REPOSITORY');

export interface HitRepository {
  save(hit: Hit): Promise<void>;
  deleteByPair(traceId: string, referencePrintId: string): Promise<void>;
  findByTraceId(traceId: string): Promise<Hit[]>;
}
