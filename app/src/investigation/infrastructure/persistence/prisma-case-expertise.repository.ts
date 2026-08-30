import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../shared/domain/ports/id-generator';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { CaseExpertise } from '../../domain/case-expertise/entity/case-expertise';
import type { CaseExpertiseRepository } from '../../domain/case-expertise/repository/case-expertise.repository';

@Injectable()
export class PrismaCaseExpertiseRepository implements CaseExpertiseRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async save(
    expertise: CaseExpertise,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    const { assistants, ...columns } = expertise.toPrimitives();

    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.caseExpertise.upsert({
        where: { id: columns.id },
        create: columns,
        update: columns,
      });
      await prisma.caseExpertiseAssistant.deleteMany({
        where: { expertiseId: columns.id },
      });
      if (assistants.length > 0) {
        await prisma.caseExpertiseAssistant.createMany({
          data: assistants.map((assistant) => ({
            id: this.idGenerator.generate(),
            expertiseId: columns.id,
            name: assistant.name,
            task: assistant.task,
          })),
        });
      }
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async findByCaseId(caseId: string): Promise<CaseExpertise | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.caseExpertise.findUnique({
      where: { caseId },
      include: {
        assistants: {
          select: { name: true, task: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    return row ? CaseExpertise.reconstitute(row) : null;
  }

  async existsForCase(caseId: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.caseExpertise.findUnique({
      where: { caseId },
      select: { id: true },
    });
    return found !== null;
  }
}
