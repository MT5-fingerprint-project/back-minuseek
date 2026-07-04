import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { Trace } from '../../domain/trace/entity/trace';
import type { TraceRepository } from '../../domain/trace/repository/trace.repository';

@Injectable()
export class PrismaTraceRepository implements TraceRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(trace: Trace): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const data = trace.toPrimitives();
    await prisma.trace.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Trace | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.trace.findUnique({ where: { id } });
    return row ? Trace.reconstitute(row) : null;
  }

  async delete(id: string): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.trace.delete({ where: { id } });
  }
}
