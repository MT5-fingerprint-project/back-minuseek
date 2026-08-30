export interface CaseUserReadModel {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CaseExpertiseReadModel {
  expert: CaseUserReadModel | null;
  courtReference: string;
  oathStatement: string;
  swornAt: Date;
}

export interface InvestigationCaseReadModel {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operator: CaseUserReadModel | null;
  expertise: CaseExpertiseReadModel | null;
  createdAt: Date;
  updatedAt: Date;
}
