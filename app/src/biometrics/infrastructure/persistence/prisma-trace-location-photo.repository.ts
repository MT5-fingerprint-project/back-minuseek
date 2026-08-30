import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { TraceLocationPhoto } from '../../domain/trace-location-photo/entity/trace-location-photo';
import type { TraceLocationPhotoRepository } from '../../domain/trace-location-photo/repository/trace-location-photo.repository';

@Injectable()
export class PrismaTraceLocationPhotoRepository implements TraceLocationPhotoRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(
    photo: TraceLocationPhoto,
    act: AuditEventDraft,
  ): Promise<AuditLink> {
    return this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const data = photo.toPrimitives();
      await prisma.traceLocationPhoto.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
      return this.auditTrail.append(act);
    });
  }

  async findByTraceId(traceId: string): Promise<TraceLocationPhoto | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.traceLocationPhoto.findUnique({
      where: { traceId },
    });
    return row ? TraceLocationPhoto.reconstitute(row) : null;
  }

  async delete(id: string, act: AuditEventDraft): Promise<AuditLink> {
    return this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.traceLocationPhoto.delete({ where: { id } });
      return this.auditTrail.append(act);
    });
  }
}
