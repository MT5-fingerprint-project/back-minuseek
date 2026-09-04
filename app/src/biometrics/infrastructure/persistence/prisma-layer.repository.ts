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
import { Layer } from '../../domain/layer/entity/layer';
import type { LayerSettings } from '../../domain/layer/entity/layer';
import { MINUTIA_SETTINGS_TYPES } from '../../domain/layer/minutia';
import type { LayerRepository } from '../../domain/layer/repository/layer.repository';

@Injectable()
export class PrismaLayerRepository implements LayerRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(layer: Layer, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const {
        id,
        fingerprintId,
        name,
        type,
        zIndex,
        isVisible,
        settings,
        createdByUserId,
      } = layer.toPrimitives();
      const payload = {
        fingerprintId,
        name,
        type,
        zIndex,
        isVisible,
        settings,
        createdByUserId,
      };
      await prisma.layer.upsert({
        where: { id },
        create: { id, ...payload },
        update: payload,
      });
      await this.auditTrail.append(act);
    });
  }

  async findById(id: string): Promise<Layer | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.layer.findUnique({ where: { id } });
    if (!row) return null;
    return Layer.reconstitute({
      ...row,
      type: row.type,
      settings: row.settings as LayerSettings,
    });
  }

  async delete(id: string, acts: readonly AuditEventDraft[]): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.layer.delete({ where: { id } });
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async countMinutiae(fingerprintId: string): Promise<number> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.layer.count({
      where: {
        fingerprintId,
        type: 'ANNOTATION',
        OR: MINUTIA_SETTINGS_TYPES.map((settingsType) => ({
          settings: { path: ['type'], equals: settingsType },
        })),
      },
    });
  }
}
