import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { ServiceSettings } from '../entity/service-settings';

export interface ServiceSettingsRepository {
  find(): Promise<ServiceSettings | null>;
  save(settings: ServiceSettings, ...acts: AuditEventDraft[]): Promise<void>;
}

export const SERVICE_SETTINGS_REPOSITORY = 'ServiceSettingsRepository';
