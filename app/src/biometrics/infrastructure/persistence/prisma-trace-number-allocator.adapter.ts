import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { TraceNumberAllocatorPort } from '../../application/ports/trace-number-allocator.port';

@Injectable()
export class PrismaTraceNumberAllocatorAdapter implements TraceNumberAllocatorPort {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async allocate(caseId: string): Promise<number> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.investigationCase.update({
      where: { id: caseId },
      data: { lastTraceNumber: { increment: 1 } },
      select: { lastTraceNumber: true },
    });
    return row.lastTraceNumber;
  }
}
