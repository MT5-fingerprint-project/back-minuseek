import {
  DesignatableServiceUser,
  ServiceUserDirectory,
} from '../../application/ports/service-user.directory';

export class InMemoryServiceUserDirectory implements ServiceUserDirectory {
  constructor(private readonly accounts: DesignatableServiceUser[] = []) {}

  findById(userId: string): Promise<DesignatableServiceUser | null> {
    return Promise.resolve(
      this.accounts.find((account) => account.id === userId) ?? null,
    );
  }
}
