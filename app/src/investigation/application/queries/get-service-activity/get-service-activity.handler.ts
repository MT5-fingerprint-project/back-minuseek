import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import { ServiceActivityNotAllowedError } from '../../../domain/investigation-case/errors/service-activity-not-allowed.error';
import { GetServiceActivityQuery } from './get-service-activity.query';
import { ServiceActivityReadModel } from './service-activity-read-model';
import {
  SERVICE_ACTIVITY_READER,
  ServiceActivityReader,
} from './service-activity.reader';

@QueryHandler(GetServiceActivityQuery)
export class GetServiceActivityHandler implements IQueryHandler<
  GetServiceActivityQuery,
  ServiceActivityReadModel
> {
  constructor(
    @Inject(SERVICE_ACTIVITY_READER)
    private readonly reader: ServiceActivityReader,
  ) {}

  async execute(
    query: GetServiceActivityQuery,
  ): Promise<ServiceActivityReadModel> {
    if (query.requester.role !== UserRoleEnum.ADMIN) {
      throw new ServiceActivityNotAllowedError();
    }

    const operatorUserId = query.operatorUserId ?? null;
    if (
      operatorUserId !== null &&
      !(await this.reader.operatorExists(operatorUserId))
    ) {
      throw new UnknownOperatorError(operatorUserId);
    }

    return await this.reader.read(operatorUserId);
  }
}
