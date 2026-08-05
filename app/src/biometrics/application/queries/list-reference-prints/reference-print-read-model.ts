export interface ReferencePrintMatchingReadModel {
  traceId: string;
  score: number;
  match: boolean;
}

export interface ReferencePrintReadModel {
  id: string;
  path: string;
  caseId: string;
  subjectId: string | null;
  position: string | null;
  createdAt: Date;
  matchings: ReferencePrintMatchingReadModel[];
}
