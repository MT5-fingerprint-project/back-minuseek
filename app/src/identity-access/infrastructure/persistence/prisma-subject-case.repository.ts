import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { SubjectType as PrismaSubjectType } from '../../../../generated/prisma/enums';
import { SubjectCase } from '../../domain/subject-case/entity/subject-case';
import type { SubjectCaseRepository } from '../../domain/subject-case/repository/subject-case.repository';

@Injectable()
export class PrismaSubjectCaseRepository implements SubjectCaseRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(subjectCase: SubjectCase): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const p = subjectCase.toPrimitives();
    await prisma.subjectCase.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        subjectId: p.subjectId,
        caseId: p.caseId,
        type: p.type as PrismaSubjectType,
      },
      update: {
        type: p.type as PrismaSubjectType,
      },
    });
  }

  async existsBySubjectAndCase(
    subjectId: string,
    caseId: string,
  ): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.subjectCase.findUnique({
      where: { subjectId_caseId: { subjectId, caseId } },
      select: { id: true },
    });
    return found !== null;
  }
}
