import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Matching } from '../../domain/matching/entity/matching';
import type { MatchingRepository } from '../../domain/matching/repository/matching.repository';

@Injectable()
export class PrismaMatchingRepository implements MatchingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(matchings: Matching[]): Promise<void> {
    await this.prisma.$transaction(
      matchings.map((matching) => {
        const data = matching.toPrimitives();
        return this.prisma.matching.upsert({
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
    const rows = await this.prisma.matching.findMany({ where: { traceId } });
    return rows.map((row) => Matching.create(row));
  }
}
