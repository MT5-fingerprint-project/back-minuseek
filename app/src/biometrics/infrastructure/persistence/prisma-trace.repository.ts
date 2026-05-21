import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { Trace } from '../../domain/trace';
import { TraceRepository } from '../../domain/trace.repository';

@Injectable()
export class PrismaTraceRepository implements TraceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(trace: Trace): Promise<void> {
    const data = trace.toPrimitives();
    await this.prisma.trace.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Trace | null> {
    const row = await this.prisma.trace.findUnique({ where: { id } });
    return row ? Trace.reconstitute(row) : null;
  }
}
