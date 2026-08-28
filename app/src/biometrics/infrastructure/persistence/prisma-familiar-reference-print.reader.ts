import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import type { FamiliarReferencePrintReader } from '../../application/ports/familiar-reference-print.reader';

const FAMILIAR = 'CLOSE_ASSOCIATE';

@Injectable()
export class PrismaFamiliarReferencePrintReader implements FamiliarReferencePrintReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findDestroyableByCaseId(caseId: string): Promise<ReferencePrint[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const familiars = await prisma.subject.findMany({
      where: { caseId, type: FAMILIAR },
      select: { id: true },
    });
    if (familiars.length === 0) {
      return [];
    }

    const rows = await prisma.referencePrint.findMany({
      where: {
        caseId,
        imageDestroyedAt: null,
        subjectId: { in: familiars.map((familiar) => familiar.id) },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ReferencePrint.reconstitute(row));
  }
}
