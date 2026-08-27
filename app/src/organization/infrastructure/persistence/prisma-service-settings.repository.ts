import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { ServiceSettings } from '../../domain/service-settings/entity/service-settings';
import type { ServiceSettingsRepository } from '../../domain/service-settings/repository/service-settings.repository';

/** Le réglage est unique par service : une clé fixe, jamais un identifiant à inventer. */
export const SERVICE_SETTINGS_ROW_ID = 'service-settings';

@Injectable()
export class PrismaServiceSettingsRepository implements ServiceSettingsRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(
    settings: ServiceSettings,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const columns = settings.toPrimitives();
      await prisma.serviceSettings.upsert({
        where: { id: SERVICE_SETTINGS_ROW_ID },
        create: { id: SERVICE_SETTINGS_ROW_ID, ...columns },
        update: columns,
      });
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async find(): Promise<ServiceSettings | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.serviceSettings.findUnique({
      where: { id: SERVICE_SETTINGS_ROW_ID },
    });
    return row ? ServiceSettings.reconstitute(row) : null;
  }
}
