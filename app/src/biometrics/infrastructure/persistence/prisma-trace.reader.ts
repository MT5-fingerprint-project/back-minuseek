import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  NOT_WITHDRAWN,
  WITHDRAWN_ONLY,
} from '../../../shared/infrastructure/persistence/withdrawal';
import { CaptureQualityProps } from '../../domain/trace/value-objects/capture-quality.vo';
import { TraceReadModel } from '../../application/queries/list-traces/trace-read-model';
import type { TraceReader } from '../../application/queries/list-traces/trace.reader';

@Injectable()
export class PrismaTraceReader implements TraceReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(
    caseId: string,
    withdrawn = false,
  ): Promise<TraceReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.trace.findMany({
      where: { caseId, ...(withdrawn ? WITHDRAWN_ONLY : NOT_WITHDRAWN) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    // Prisma rend la colonne `Json?` non typée : seul le domaine y écrit, via
    // `CaptureQuality.toPrimitives()`.
    return rows.map((row) => ({
      ...row,
      captureQuality: row.captureQuality as CaptureQualityProps | null,
    }));
  }
}
