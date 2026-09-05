import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMyWorkQuery } from './get-my-work.query';
import { MyWorkReadModel } from './my-work-read-model';
import { MY_WORK_READER, MyWorkReader } from './my-work.reader';

@QueryHandler(GetMyWorkQuery)
export class GetMyWorkHandler implements IQueryHandler<
  GetMyWorkQuery,
  MyWorkReadModel
> {
  constructor(
    @Inject(MY_WORK_READER)
    private readonly reader: MyWorkReader,
  ) {}

  // Aucune garde de rôle : le périmètre n'est pas un paramètre mais l'appelant
  // lui-même, résolu par le controller. Un opérateur ne peut donc pas demander
  // le travail d'un autre.
  async execute(query: GetMyWorkQuery): Promise<MyWorkReadModel> {
    return await this.reader.read(query.operatorUserId);
  }
}
