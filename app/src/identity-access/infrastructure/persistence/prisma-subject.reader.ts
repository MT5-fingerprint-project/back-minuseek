import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { SubjectReadModel } from '../../application/queries/get-subject-by-id/subject-read-model';
import type { SubjectReader } from '../../application/queries/get-subject-by-id/subject.reader';

@Injectable()
export class PrismaSubjectReader implements SubjectReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findById(id: string): Promise<SubjectReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.subject.findUnique({
      where: { id },
      include: {
        cases: {
          select: { caseId: true, type: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      birthDate: row.birthDate,
      birthPlace: row.birthPlace,
      firstParentName: row.firstParentName,
      secondParentName: row.secondParentName,
      phoneNumber: row.phoneNumber,
      sex: row.sex,
      color: row.color,
      cases: row.cases.map((c) => ({ caseId: c.caseId, type: c.type })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
