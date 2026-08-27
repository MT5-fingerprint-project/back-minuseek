import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
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

  async execute(): Promise<string[]> {
    return this.reader.listGrades();
  }
}
