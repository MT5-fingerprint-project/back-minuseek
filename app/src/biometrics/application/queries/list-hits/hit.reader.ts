import { HitReadModel } from './hit-read-model';

export interface HitReader {
  findByTraceId(traceId: string): Promise<HitReadModel[]>;
}

export const HIT_READER = Symbol('HIT_READER');
