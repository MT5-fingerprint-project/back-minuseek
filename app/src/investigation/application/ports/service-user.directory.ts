export const SERVICE_USER_DIRECTORY = 'ServiceUserDirectory';

export interface DesignatableServiceUser {
  id: string;
  disabled: boolean;
  firstName: string;
  lastName: string;
}

export function serviceUserName({
  firstName,
  lastName,
}: DesignatableServiceUser): string {
  return `${firstName} ${lastName}`;
}

export interface ServiceUserDirectory {
  findById(userId: string): Promise<DesignatableServiceUser | null>;
}
