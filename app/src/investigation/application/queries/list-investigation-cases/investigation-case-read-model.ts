export interface InvestigationCaseReadModel {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operatorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
