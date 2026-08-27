import { ServiceSettingsReadModel } from '../../application/queries/get-service-settings/service-settings-read-model';
import { ServiceSettingsReader } from '../../application/queries/get-service-settings/service-settings.reader';

export class InMemoryServiceSettingsReader implements ServiceSettingsReader {
  constructor(private stored: ServiceSettingsReadModel | null = null) {}

  seed(settings: ServiceSettingsReadModel): void {
    this.stored = settings;
  }

  find(): Promise<ServiceSettingsReadModel | null> {
    return Promise.resolve(this.stored);
  }
}
