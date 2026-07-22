export interface SubjectCaseReadModel {
  caseId: string;
  type: string;
}

export interface SubjectReadModel {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
  firstParentName: string | null;
  secondParentName: string | null;
  phoneNumber: string | null;
  sex: string;
  color: string | null;
  cases: SubjectCaseReadModel[];
  createdAt: Date;
  updatedAt: Date;
}
