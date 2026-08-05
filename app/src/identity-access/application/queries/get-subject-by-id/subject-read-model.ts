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
  type: string;
  color: string | null;
  caseId: string;
  createdAt: Date;
  updatedAt: Date;
}
