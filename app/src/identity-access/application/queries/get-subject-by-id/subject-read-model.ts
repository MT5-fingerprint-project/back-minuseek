export interface SubjectReadModel {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  birthPlace: string | null;
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
