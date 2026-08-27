import {
  DesignatableServiceUser,
  ServiceUserDirectory,
} from '../../application/ports/service-user.directory';

export class InMemoryServiceUserDirectory implements ServiceUserDirectory {
  constructor(
    private readonly userIds: string[] = [],
    private readonly disabledUserIds: string[] = [],
  ) {}

  findById(userId: string): Promise<DesignatableServiceUser | null> {
    if (!this.userIds.includes(userId)) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      id: userId,
      disabled: this.disabledUserIds.includes(userId),
    });
  }
}
