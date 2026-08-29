import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetServiceSettingsQuery } from '../../../organization/application/queries/get-service-settings/get-service-settings.query';
import type { ServiceSettingsReadModel } from '../../../organization/application/queries/get-service-settings/service-settings-read-model';
import type {
  ServiceLetterheadData,
  ServiceLetterheadReader,
} from '../../application/ports/service-letterhead.reader';

@Injectable()
export class QueryBusServiceLetterheadAdapter implements ServiceLetterheadReader {
  constructor(private readonly queryBus: QueryBus) {}

  async read(): Promise<ServiceLetterheadData> {
    const settings = await this.queryBus.execute<
      GetServiceSettingsQuery,
      ServiceSettingsReadModel
    >(new GetServiceSettingsQuery());

    return {
      administration: settings.administration,
      serviceName: settings.serviceName,
      postalAddress: settings.postalAddress,
      phoneNumber: settings.phoneNumber,
      email: settings.email,
      signatureCity: settings.signatureCity,
    };
  }
}
