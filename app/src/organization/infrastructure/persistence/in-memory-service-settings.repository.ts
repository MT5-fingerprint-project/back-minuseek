import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { ServiceSettings } from '../../domain/service-settings/entity/service-settings';
import { ServiceSettingsRepository } from '../../domain/service-settings/repository/service-settings.repository';

export class InMemoryServiceSettingsRepository implements ServiceSettingsRepository {
  private stored: ServiceSettings | null = null;

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(settings: ServiceSettings): void {
    this.stored = settings;
  }

  find(): Promise<ServiceSettings | null> {
    return Promise.resolve(this.stored);
  }

  async save(
    settings: ServiceSettings,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    this.stored = settings;
    for (const act of acts) {
      await this.auditTrail.append(act);
    }
  }
}
