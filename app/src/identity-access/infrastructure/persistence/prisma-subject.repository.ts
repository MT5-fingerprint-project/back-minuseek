import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  Sex as PrismaSex,
  SubjectType as PrismaSubjectType,
} from '../../../../generated/prisma/enums';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { Subject } from '../../domain/subject/entity/subject';
import type { SubjectRepository } from '../../domain/subject/repository/subject.repository';

@Injectable()
export class PrismaSubjectRepository implements SubjectRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(subject: Subject, ...acts: AuditEventDraft[]): Promise<void> {
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
      type: p.type as PrismaSubjectType,
      color: p.color,
      caseId: p.caseId,
    };

    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
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
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }
}
