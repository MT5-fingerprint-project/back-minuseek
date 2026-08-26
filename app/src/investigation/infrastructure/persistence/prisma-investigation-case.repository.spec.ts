import { EXPERT_ACTOR } from '../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type { AuditTrailPort } from '../../../shared/domain/ports/audit-trail.port';
import type { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';
import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { PrismaInvestigationCaseRepository } from './prisma-investigation-case.repository';

const MARIE = 'user-marie';

interface UpsertArgs {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

class FakePrismaClient {
  readonly upsertArgs: UpsertArgs[] = [];
  row: Record<string, unknown> | null = null;

  readonly investigationCase = {
    upsert: (args: UpsertArgs): Promise<void> => {
      this.upsertArgs.push(args);
      return Promise.resolve();
    },
    findUnique: (): Promise<Record<string, unknown> | null> =>
      Promise.resolve(this.row),
  };
}

function build() {
  const prisma = new FakePrismaClient();
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  const transactionRunner: TransactionRunner = {
    run: <T>(work: () => Promise<T>) => work(),
  };
  const auditTrail: AuditTrailPort = { append: () => Promise.resolve() };

  return {
    prisma,
    repository: new PrismaInvestigationCaseRepository(
      tenantConnection,
      transactionRunner,
      auditTrail,
    ),
  };
}

const CASE_OPENED = {
  eventType: AuditEventTypeEnum.CASE_OPENED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: EXPERT_ACTOR,
  caseId: 'case-1',
  payload: {},
};

describe('PrismaInvestigationCaseRepository', () => {
  it("écrit l'opérateur à la création du dossier", async () => {
    const { repository, prisma } = build();

    await repository.save(
      InvestigationCase.open({
        id: 'case-1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2024-001',
        operatorUserId: MARIE,
      }),
      CASE_OPENED,
    );

    expect(prisma.upsertArgs[0].create).toMatchObject({
      operatorUserId: MARIE,
    });
  });

  it("réécrit l'opérateur à chaque modification, pour qu'il ne s'efface pas", async () => {
    const { repository, prisma } = build();

    await repository.save(
      InvestigationCase.reconstitute({
        id: 'case-1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2024-001',
        description: null,
        status: InvestigationCaseStatusEnum.IN_PROGRESS,
        operatorUserId: MARIE,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-02T10:00:00Z'),
      }),
      CASE_OPENED,
    );

    expect(prisma.upsertArgs[0].update).toMatchObject({
      operatorUserId: MARIE,
    });
  });

  it('relit un dossier avec son opérateur et son statut', async () => {
    const { repository, prisma } = build();
    prisma.row = {
      id: 'case-1',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: null,
      status: InvestigationCaseStatusEnum.CLOSED,
      operatorUserId: MARIE,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
    };

    const found = await repository.findById('case-1');

    expect(found!.operatorUserId).toBe(MARIE);
    expect(found!.status).toBe(InvestigationCaseStatusEnum.CLOSED);
  });

  it('rend null quand le dossier demandé n’existe pas', async () => {
    const { repository } = build();

    expect(await repository.findById('case-fantome')).toBeNull();
  });
});
