import { EXPERT_ACTOR } from '../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
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
  const appended: AuditEventDraft[] = [];
  const auditTrail: AuditTrailPort = {
    append: (draft) => {
      appended.push(draft);
      return Promise.resolve();
    },
  };

  return {
    prisma,
    appended,
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

const CASE_OPERATOR_CHANGED = {
  ...CASE_OPENED,
  eventType: AuditEventTypeEnum.CASE_OPERATOR_CHANGED,
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

  it("réécrit toutes les colonnes à la modification, pour qu'aucune ne se perde", async () => {
    const { repository, prisma } = build();

    await repository.save(
      InvestigationCase.reconstitute({
        id: 'case-1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2026-118',
        description: 'Vol avec effraction',
        status: InvestigationCaseStatusEnum.IN_PROGRESS,
        operatorUserId: MARIE,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-02T10:00:00Z'),
      }),
      CASE_OPENED,
    );

    const [{ create, update }] = prisma.upsertArgs;
    expect(update).toEqual({
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2026-118',
      description: 'Vol avec effraction',
      status: InvestigationCaseStatusEnum.IN_PROGRESS,
      operatorUserId: MARIE,
      updatedAt: new Date('2026-01-02T10:00:00Z'),
    });
    const colonnesDeCreation = Object.keys(create).filter(
      (column) => column !== 'id' && column !== 'createdAt',
    );
    expect(colonnesDeCreation.every((column) => column in update)).toBe(true);
  });

  it('écrit null quand la description a été vidée, au lieu de la laisser en place', async () => {
    const { repository, prisma } = build();

    const investigationCase = InvestigationCase.reconstitute({
      id: 'case-1',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: 'Vol à main armée',
      status: InvestigationCaseStatusEnum.OPEN,
      operatorUserId: MARIE,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });
    investigationCase.correct({ description: null });

    await repository.save(investigationCase, CASE_OPENED);

    expect(prisma.upsertArgs[0].update).toMatchObject({ description: null });
  });

  it('inscrit les deux actes d’une même sauvegarde, dans leur ordre', async () => {
    const { repository, appended } = build();

    await repository.save(
      InvestigationCase.open({
        id: 'case-1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2024-001',
        operatorUserId: MARIE,
      }),
      CASE_OPENED,
      CASE_OPERATOR_CHANGED,
    );

    expect(appended.map((draft) => draft.eventType)).toEqual([
      AuditEventTypeEnum.CASE_OPENED,
      AuditEventTypeEnum.CASE_OPERATOR_CHANGED,
    ]);
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
