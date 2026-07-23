export interface UserReadModel {
  id: string;
  identityProviderId: string;
  role: string;
  grade: string;
  serviceNumber: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}
