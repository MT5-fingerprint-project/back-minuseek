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
  requestDate: Date | null;
  requesterQuality: string | null;
  requesterName: string | null;
  requesterService: string | null;
  offenseNature: string | null;
  offenseLocation: string | null;
  offenseDateFrom: Date | null;
  offenseDateTo: Date | null;
  interventionDate: Date | null;
  caseAgainst: string | null;
  createdAt: Date;
  updatedAt: Date;
}
