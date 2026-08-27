import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';

export interface ServiceUsersFilters {
  search?: string;
  role?: UserRoleEnum;
  grade?: string;
  status?: UserStatusEnum;
}
