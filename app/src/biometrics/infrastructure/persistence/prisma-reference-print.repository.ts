import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import type { ReferencePrintRepository } from '../../domain/reference-print/repository/reference-print.repository';

@Injectable()
export class PrismaReferencePrintRepository implements ReferencePrintRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(rp: ReferencePrint): Promise<void> {
    const data = rp.toPrimitives();
    await this.prisma.referencePrint.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<ReferencePrint | null> {
    const row = await this.prisma.referencePrint.findUnique({ where: { id } });
    return row ? ReferencePrint.reconstitute(row) : null;
  }
}
