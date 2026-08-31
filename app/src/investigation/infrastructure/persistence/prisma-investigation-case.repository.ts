import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import type { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';

@Injectable()
export class PrismaInvestigationCaseRepository implements InvestigationCaseRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(c: InvestigationCase, ...acts: AuditEventDraft[]): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      // Une seule liste pour les deux branches de l'upsert : une colonne
      // oubliée ici serait écrite à la création puis perdue à la première
      // modification, sans erreur.
      const columns = {
        caseNumber: c.caseNumber,
        pvNumber: c.pvNumber,
        description: c.description ?? null,
        status: c.status,
        operatorUserId: c.operatorUserId,
        ...c.judicialHeader,
        ...c.recipient,
        updatedAt: c.updatedAt,
      };
      await prisma.investigationCase.upsert({
        where: { id: c.id },
        create: { id: c.id, createdAt: c.createdAt, ...columns },
        update: columns,
      });
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async findById(id: string): Promise<InvestigationCase | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.investigationCase.findUnique({ where: { id } });
    return row ? InvestigationCase.reconstitute(row) : null;
  }

  async existsByCaseNumber(caseNumber: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.investigationCase.findUnique({
      where: { caseNumber },
      select: { id: true },
    });
    return found !== null;
  }
}
