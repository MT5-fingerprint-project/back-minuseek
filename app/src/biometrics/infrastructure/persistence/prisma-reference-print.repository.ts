import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { FingerPosition as PrismaFingerPosition } from '../../../../generated/prisma/enums';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import type { ReferencePrintRepository } from '../../domain/reference-print/repository/reference-print.repository';

@Injectable()
export class PrismaReferencePrintRepository implements ReferencePrintRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(rp: ReferencePrint): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const p = rp.toPrimitives();
    const data = {
      id: p.id,
      path: p.path,
      caseId: p.caseId,
      subjectId: p.subjectId,
      position: p.position as PrismaFingerPosition | null,
    };
    await prisma.referencePrint.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<ReferencePrint | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.referencePrint.findUnique({ where: { id } });
    return row ? ReferencePrint.reconstitute(row) : null;
  }

  async delete(id: string): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.referencePrint.delete({ where: { id } });
  }
}
