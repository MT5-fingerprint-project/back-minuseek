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
  withdrawnAt: Date | null;
  withdrawalMotive: string | null;
  withdrawalMotiveDetail: string | null;
  imageDestroyedAt: Date | null;
  resolutionDpi: number | null;
  thumbPath: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
}
