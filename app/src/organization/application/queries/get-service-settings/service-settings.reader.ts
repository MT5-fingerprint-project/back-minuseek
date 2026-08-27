import { ServiceSettingsReadModel } from './service-settings-read-model';

export interface ServiceSettingsReader {
  find(): Promise<ServiceSettingsReadModel | null>;
}

export const SERVICE_SETTINGS_READER = 'ServiceSettingsReader';
