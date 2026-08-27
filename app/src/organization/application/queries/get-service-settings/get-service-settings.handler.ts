import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetServiceSettingsQuery } from './get-service-settings.query';
import {
  blankServiceSettings,
  ServiceSettingsReadModel,
} from './service-settings-read-model';
import {
  SERVICE_SETTINGS_READER,
  ServiceSettingsReader,
} from './service-settings.reader';

@QueryHandler(GetServiceSettingsQuery)
export class GetServiceSettingsHandler implements IQueryHandler<
  GetServiceSettingsQuery,
  ServiceSettingsReadModel
> {
  constructor(
    @Inject(SERVICE_SETTINGS_READER)
    private readonly reader: ServiceSettingsReader,
  ) {}

  async execute(): Promise<ServiceSettingsReadModel> {
    return (await this.reader.find()) ?? blankServiceSettings();
  }
}
