export interface CaseOperatorReadModel {
  id: string;
  firstName: string;
  lastName: string;
}

export interface InvestigationCaseReadModel {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operator: CaseOperatorReadModel | null;
  createdAt: Date;
  updatedAt: Date;
}
