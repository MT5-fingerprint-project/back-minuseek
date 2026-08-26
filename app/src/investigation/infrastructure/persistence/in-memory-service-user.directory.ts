import { ServiceUserDirectory } from '../../application/ports/service-user.directory';

export class InMemoryServiceUserDirectory implements ServiceUserDirectory {
  constructor(private readonly userIds: string[] = []) {}

  exists(userId: string): Promise<boolean> {
    return Promise.resolve(this.userIds.includes(userId));
  }
}
