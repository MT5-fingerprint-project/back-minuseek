export interface TraceReadModel {
  id: string;
  path: string;
  status: string;
  score: number | null;
  caseId: string;
  createdAt: Date;
}
