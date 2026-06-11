import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TraceReadModel } from '../../application/queries/list-traces/trace-read-model';
import type { TraceReader } from '../../application/queries/list-traces/trace.reader';

@Injectable()
export class PrismaTraceReader implements TraceReader {
  constructor(private readonly prisma: PrismaService) {}

  findByCaseId(caseId: string): Promise<TraceReadModel[]> {
    return this.prisma.trace.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
