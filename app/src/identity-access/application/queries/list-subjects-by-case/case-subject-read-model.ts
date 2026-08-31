export interface CaseSubjectReadModel {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  birthPlace: string | null;
  firstParentName: string | null;
  secondParentName: string | null;
  phoneNumber: string | null;
  sex: string;
  color: string | null;
  type: string;
  createdAt: Date;
}
