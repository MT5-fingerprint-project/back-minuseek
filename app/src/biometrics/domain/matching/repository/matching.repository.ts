import { Matching } from '../entity/matching';

export interface MatchingRepository {
  upsertMany(matchings: Matching[]): Promise<void>;
  findByTraceId(traceId: string): Promise<Matching[]>;
}

export const MATCHING_REPOSITORY = 'MatchingRepository';
