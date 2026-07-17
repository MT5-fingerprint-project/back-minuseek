export interface ReferencePrintMatchingReadModel {
  traceId: string;
  score: number;
  match: boolean;
}

export interface ReferencePrintReadModel {
  id: string;
  path: string;
  caseId: string;
  createdAt: Date;
  matchings: ReferencePrintMatchingReadModel[];
}
