import type { PrismaClient } from '../../../../generated/prisma/client';
import { EXPERT_ACTOR } from '../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type { AuditTrailPort } from '../../../shared/domain/ports/audit-trail.port';
import type { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { FileDigest } from '../../domain/file-digest.vo';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import { WithdrawalMotiveEnum } from '../../domain/withdrawal/withdrawal.vo';
import { PrismaReferencePrintRepository } from './prisma-reference-print.repository';

const THUMB =
  'media/investigation-case/case-9/reference-prints/ref-1_thumb.webp';

interface UpsertArgs {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

/** Ce qu'une ligne de la table rend d'une colonne que l'upsert n'a pas écrite. */
const UNWRITTEN_COLUMNS = {
  sha256: null,
  displayableSha256: null,
  subjectId: null,
  position: null,
  withdrawnAt: null,
  withdrawalMotive: null,
  withdrawalMotiveDetail: null,
  imageDestroyedAt: null,
  resolutionDpi: null,
  thumbPath: null,
  sourceWidth: null,
  sourceHeight: null,
};

class FakePrismaClient {
  readonly upsertArgs: UpsertArgs[] = [];
  private readonly rows = new Map<string, Record<string, unknown>>();

  readonly referencePrint = {
    upsert: (args: UpsertArgs): Promise<void> => {
      this.upsertArgs.push(args);
      this.rows.set(args.where.id, { ...UNWRITTEN_COLUMNS, ...args.create });
      return Promise.resolve();
    },
    findUnique: (args: {
      where: { id: string };
    }): Promise<Record<string, unknown> | null> =>
      Promise.resolve(this.rows.get(args.where.id) ?? null),
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

const WITHDRAWN = {
  ...UPLOADED,
  eventType: AuditEventTypeEnum.REFERENCE_PRINT_DELETED,
};

const WITHDRAWN_AT = new Date('2026-09-03T14:20:00.000Z');
const MOTIVE_DETAIL = 'planche rejouée par le FAED après recalibrage';

function aReferencePrintWithdrawnForOther(): ReferencePrint {
  const referencePrint = aReferencePrint(THUMB);
  referencePrint.withdraw(
    WithdrawalMotiveEnum.OTHER,
    WITHDRAWN_AT,
    MOTIVE_DETAIL,
  );
  return referencePrint;
}

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

  it('écrit la précision du motif dans les deux branches de l’upsert', async () => {
    const { repository, prisma } = build();

    await repository.save(aReferencePrintWithdrawnForOther(), WITHDRAWN);

    const [{ create, update }] = prisma.upsertArgs;
    expect(create).toMatchObject({
      withdrawalMotive: WithdrawalMotiveEnum.OTHER,
      withdrawalMotiveDetail: MOTIVE_DETAIL,
    });
    expect(update).toMatchObject({
      withdrawalMotive: WithdrawalMotiveEnum.OTHER,
      withdrawalMotiveDetail: MOTIVE_DETAIL,
    });
  });

  it('relit la phrase de l’opérateur après un aller-retour en base', async () => {
    const { repository } = build();

    await repository.save(aReferencePrintWithdrawnForOther(), WITHDRAWN);
    const reread = await repository.findById('ref-1');

    expect(reread?.isWithdrawn).toBe(true);
    expect(reread?.withdrawalMotiveDetail).toBe(MOTIVE_DETAIL);
  });
});
