import { HitReadModel } from './hit-read-model';

export interface HitReader {
  findByTraceId(
    traceId: string,
    declaredBy?: string | null,
  ): Promise<HitReadModel[]>;
}

export const HIT_READER = Symbol('HIT_READER');
