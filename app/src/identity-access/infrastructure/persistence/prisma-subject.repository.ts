import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { Sex as PrismaSex } from '../../../../generated/prisma/enums';
import { Subject } from '../../domain/subject/entity/subject';
import type { SubjectRepository } from '../../domain/subject/repository/subject.repository';

@Injectable()
export class PrismaSubjectRepository implements SubjectRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(subject: Subject): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const p = subject.toPrimitives();
    const data = {
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate,
      birthPlace: p.birthPlace,
      firstParentName: p.firstParentName,
      secondParentName: p.secondParentName,
      phoneNumber: p.phoneNumber,
      sex: p.sex as PrismaSex,
      color: p.color,
    };
    await prisma.subject.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        ...data,
      },
      update: {
        updatedAt: p.updatedAt,
        ...data,
      },
    });
  }

  async findById(id: string): Promise<Subject | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.subject.findUnique({ where: { id } });
    return row ? Subject.reconstitute(row) : null;
  }
}
