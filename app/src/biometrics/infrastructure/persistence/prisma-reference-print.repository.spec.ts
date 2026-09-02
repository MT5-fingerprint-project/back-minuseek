import type { PrismaClient } from '../../../../generated/prisma/client';
import { EXPERT_ACTOR } from '../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type { AuditTrailPort } from '../../../shared/domain/ports/audit-trail.port';
import type { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { FileDigest } from '../../domain/file-digest.vo';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import { PrismaReferencePrintRepository } from './prisma-reference-print.repository';

const THUMB =
  'media/investigation-case/case-9/reference-prints/ref-1_thumb.webp';

interface UpsertArgs {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

class FakePrismaClient {
  readonly upsertArgs: UpsertArgs[] = [];

  readonly referencePrint = {
    upsert: (args: UpsertArgs): Promise<void> => {
      this.upsertArgs.push(args);
      return Promise.resolve();
    },
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
  const auditTrail: AuditTrailPort = {
    append: () =>
      Promise.resolve({
        seq: 1n,
        occurredAt: new Date('2026-09-02T09:00:00.000Z'),
      }),
  };

  return {
    prisma,
    repository: new PrismaReferencePrintRepository(
      tenantConnection,
      transactionRunner,
      auditTrail,
    ),
  };
}

function aReferencePrint(thumbPath: string | null): ReferencePrint {
  return ReferencePrint.create({
    id: 'ref-1',
    path: 'media/investigation-case/case-9/reference-prints/ref-1.png',
    caseId: 'case-9',
    sha256: FileDigest.ofBuffer(Buffer.from('reference-print')),
    thumbPath,
  });
}

const UPLOADED = {
  eventType: AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: EXPERT_ACTOR,
  caseId: 'case-9',
  payload: {},
};

describe('PrismaReferencePrintRepository', () => {
  it('écrit le chemin de la vignette dans les deux branches de l’upsert', async () => {
    const { repository, prisma } = build();

    await repository.save(aReferencePrint(THUMB), UPLOADED);

    const [{ create, update }] = prisma.upsertArgs;
    expect(create).toMatchObject({ thumbPath: THUMB });
    expect(update).toMatchObject({ thumbPath: THUMB });
  });

  it('écrit une vignette vide quand le dépôt n’a pas su la fabriquer', async () => {
    const { repository, prisma } = build();

    await repository.save(aReferencePrint(null), UPLOADED);

    expect(prisma.upsertArgs[0].create).toMatchObject({ thumbPath: null });
  });
});
