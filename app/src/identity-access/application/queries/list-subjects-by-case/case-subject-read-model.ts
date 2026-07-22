export interface CaseSubjectReadModel {
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
  type: string;
  createdAt: Date;
}
