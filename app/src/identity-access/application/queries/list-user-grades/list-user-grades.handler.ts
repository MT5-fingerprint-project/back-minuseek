import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserAdministrationNotAllowedError } from '../../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import {
  SERVICE_USER_GRADES_READER,
  ServiceUserGradesReader,
} from './service-user-grades.reader';
import { ListUserGradesQuery } from './list-user-grades.query';

@QueryHandler(ListUserGradesQuery)
export class ListUserGradesHandler implements IQueryHandler<
  ListUserGradesQuery,
  string[]
> {
  constructor(
    @Inject(SERVICE_USER_GRADES_READER)
    private readonly reader: ServiceUserGradesReader,
  ) {}

  // async : le refus doit ressortir en promesse rejetée, comme celui de la
  // liste, et non en jet synchrone.
  async execute(query: ListUserGradesQuery): Promise<string[]> {
    if (query.requester?.role !== UserRoleEnum.ADMIN) {
      throw new UserAdministrationNotAllowedError();
    }
    return this.reader.listGrades();
  }
}
