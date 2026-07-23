import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { CaseSubjectReadModel } from '../../application/queries/list-subjects-by-case/case-subject-read-model';
import type { CaseSubjectsReader } from '../../application/queries/list-subjects-by-case/case-subjects.reader';

@Injectable()
export class PrismaCaseSubjectsReader implements CaseSubjectsReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(caseId: string): Promise<CaseSubjectReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.subject.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
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
      type: row.type,
      createdAt: row.createdAt,
    }));
  }
}
