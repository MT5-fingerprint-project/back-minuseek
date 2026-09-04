import type { PrismaClient } from '../../../../generated/prisma/client';
import { EXPERT_ACTOR } from '../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import type { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { MinutiaPair } from '../../domain/minutia-pair/entity/minutia-pair';
import { MinutiaPairAlreadyExistsError } from '../../domain/minutia-pair/errors/minutia-pair-already-exists.error';
import { PrismaMinutiaPairRepository } from './prisma-minutia-pair.repository';

const CREATED_AT = new Date('2026-09-01T10:00:00.000Z');

const PAIRED: AuditEventDraft = {
  eventType: AuditEventTypeEnum.MINUTIA_PAIRED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: EXPERT_ACTOR,
  caseId: 'case-9',
  traceId: 'trace-1',
  payload: {},
};

class UniqueViolation extends Error {
  readonly code = 'P2002';
}

class FakePrismaClient {
  createArgs: { data: Record<string, unknown> }[] = [];
  findManyArgs: unknown[] = [];
  failOnCreate: Error | null = null;

  readonly minutiaPair = {
    create: (args: { data: Record<string, unknown> }): Promise<void> => {
      if (this.failOnCreate) return Promise.reject(this.failOnCreate);
      this.createArgs.push(args);
      return Promise.resolve();
    },
    findUnique: (): Promise<null> => Promise.resolve(null),
    delete: (): Promise<void> => Promise.resolve(),
    findMany: (args: unknown): Promise<unknown[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve([]);
    },
  };
}

function build() {
  const prisma = new FakePrismaClient();
  const appended: AuditEventDraft[] = [];
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  const transactionRunner: TransactionRunner = {
    run: <T>(work: () => Promise<T>) => work(),
  };
  const auditTrail: AuditTrailPort = {
    append: (draft) => {
      appended.push(draft);
      return Promise.resolve({ seq: 1n, occurredAt: CREATED_AT });
    },
  };

  return {
    prisma,
    appended,
    repository: new PrismaMinutiaPairRepository(
      tenantConnection,
      transactionRunner,
      auditTrail,
    ),
  };
}

function aPair(): MinutiaPair {
  return MinutiaPair.fromPrimitives({
    id: 'pair-1',
    traceId: 'trace-1',
    referencePrintId: 'ref-1',
    traceMinutiaLayerId: 'layer-trace-1',
    referenceMinutiaLayerId: 'layer-ref-1',
    createdByUserId: 'user-marie',
    createdAt: CREATED_AT,
  });
}

describe('PrismaMinutiaPairRepository', () => {
  it('writes both sides of the pair and chains the act', async () => {
    const { repository, prisma, appended } = build();

    await repository.save(aPair(), PAIRED);

    expect(prisma.createArgs[0].data).toEqual({
      id: 'pair-1',
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      traceMinutiaLayerId: 'layer-trace-1',
      referenceMinutiaLayerId: 'layer-ref-1',
      createdByUserId: 'user-marie',
      createdAt: CREATED_AT,
    });
    expect(appended).toEqual([PAIRED]);
  });

  it('turns a unique index violation into a business conflict', async () => {
    const { repository, prisma } = build();
    prisma.failOnCreate = new UniqueViolation('unique');

    await expect(repository.save(aPair(), PAIRED)).rejects.toBeInstanceOf(
      MinutiaPairAlreadyExistsError,
    );
  });

  it('lets any other database failure through untouched', async () => {
    const { repository, prisma } = build();
    const outage = new Error('connexion perdue');
    prisma.failOnCreate = outage;

    await expect(repository.save(aPair(), PAIRED)).rejects.toBe(outage);
  });

  it('reads the pairs of a minutia from either side, oldest first', async () => {
    const { repository, prisma } = build();

    await repository.findByMinutiaLayerId('layer-trace-1');

    expect(prisma.findManyArgs[0]).toEqual({
      where: {
        OR: [
          { traceMinutiaLayerId: 'layer-trace-1' },
          { referenceMinutiaLayerId: 'layer-trace-1' },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });
});
