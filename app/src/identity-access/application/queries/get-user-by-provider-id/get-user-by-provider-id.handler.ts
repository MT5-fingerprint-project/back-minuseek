import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserReadModel } from './user-read-model';
import { USER_READER, UserReader } from './user.reader';
import { GetUserByProviderIdQuery } from './get-user-by-provider-id.query';
import { UserNotFoundError } from '../../../domain/user/errors/user-not-found.error';

@QueryHandler(GetUserByProviderIdQuery)
export class GetUserByProviderIdHandler
  implements IQueryHandler<GetUserByProviderIdQuery>
{
  constructor(
    @Inject(USER_READER)
    private readonly reader: UserReader,
  ) {}

  async execute(query: GetUserByProviderIdQuery): Promise<UserReadModel> {
    const user = await this.reader.findByIdentityProviderId(
      query.identityProviderId,
    );
    if (!user) throw new UserNotFoundError(query.identityProviderId);

    return user;
  }
}
