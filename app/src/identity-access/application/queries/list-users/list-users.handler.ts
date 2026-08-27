import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PageDto } from '../../../../shared/application/pagination/page.dto';
import { ServiceUserReadModel } from './service-user-read-model';
import {
  SERVICE_USERS_READER,
  ServiceUsersReader,
} from './service-users.reader';
import { ListUsersQuery } from './list-users.query';

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery> {
  constructor(
    @Inject(SERVICE_USERS_READER)
    private readonly reader: ServiceUsersReader,
  ) {}

  async execute(query: ListUsersQuery): Promise<PageDto<ServiceUserReadModel>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.reader.findAll(query.filters, {
      skip,
      take: limit,
    });

    return new PageDto(items, {
      itemCount: total,
      paginationOptions: { page, limit },
    });
  }
}
