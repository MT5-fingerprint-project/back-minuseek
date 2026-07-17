import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { Matching } from '../../domain/matching/entity/matching';
import type { MatchingRepository } from '../../domain/matching/repository/matching.repository';

@Injectable()
export class PrismaMatchingRepository implements MatchingRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async upsertMany(matchings: Matching[]): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.$transaction(
      matchings.map((matching) => {
        const data = matching.toPrimitives();
        return prisma.matching.upsert({
          where: {
            traceId_referencePrintId: {
              traceId: data.traceId,
              referencePrintId: data.referencePrintId,
            },
          },
          create: data,
          update: { score: data.score, match: data.match },
        });
      }),
    );
  }

  async findByTraceId(traceId: string): Promise<Matching[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.matching.findMany({ where: { traceId } });
    return rows.map((row) => Matching.fromPrimitives(row));
  }
}
