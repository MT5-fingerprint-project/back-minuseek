export interface InvestigationCaseReadModel {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
