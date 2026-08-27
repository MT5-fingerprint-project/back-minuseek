export interface UserReadModel {
  id: string;
  identityProviderId: string;
  role: string;
  grade: string;
  serviceNumber: string;
  status: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}
