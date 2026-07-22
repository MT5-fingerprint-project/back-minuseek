import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { CaseSubjectReadModel } from '../../application/queries/list-subjects-by-case/case-subject-read-model';
import type { CaseSubjectsReader } from '../../application/queries/list-subjects-by-case/case-subjects.reader';

@Injectable()
export class PrismaCaseSubjectsReader implements CaseSubjectsReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(caseId: string): Promise<CaseSubjectReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const links = await prisma.subjectCase.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: { subject: true },
    });

    return links.map((link) => ({
      id: link.subject.id,
      firstName: link.subject.firstName,
      lastName: link.subject.lastName,
      birthDate: link.subject.birthDate,
      birthPlace: link.subject.birthPlace,
      firstParentName: link.subject.firstParentName,
      secondParentName: link.subject.secondParentName,
      phoneNumber: link.subject.phoneNumber,
      sex: link.subject.sex,
      color: link.subject.color,
      type: link.type,
      createdAt: link.subject.createdAt,
    }));
  }
}
