import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReferencePrintReadModel } from '../../application/queries/list-reference-prints/reference-print-read-model';
import type { ReferencePrintReader } from '../../application/queries/list-reference-prints/reference-print.reader';

@Injectable()
export class PrismaReferencePrintReader implements ReferencePrintReader {
  constructor(private readonly prisma: PrismaService) {}

  findByCaseId(caseId: string): Promise<ReferencePrintReadModel[]> {
    return this.prisma.referencePrint.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
