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
import { ServiceSettings } from '../../domain/service-settings/entity/service-settings';
import { PrismaServiceSettingsRepository } from './prisma-service-settings.repository';

const SRPTS = {
  administration:
    "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

const SERVICE_HEADER_SAVED: AuditEventDraft = {
  eventType: AuditEventTypeEnum.SERVICE_HEADER_SAVED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: EXPERT_ACTOR,
  caseId: null,
  payload: { changes: SRPTS },
};

interface UpsertArgs {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

class FakePrismaClient {
  readonly upsertArgs: UpsertArgs[] = [];
  readonly findArgs: { where: { id: string } }[] = [];
  row: Record<string, unknown> | null = null;

  readonly serviceSettings = {
    upsert: (args: UpsertArgs): Promise<void> => {
      this.upsertArgs.push(args);
      return Promise.resolve();
    },
    findUnique: (args: {
      where: { id: string };
    }): Promise<Record<string, unknown> | null> => {
      this.findArgs.push(args);
      return Promise.resolve(this.row);
    },
  };
}

function build() {
  const prisma = new FakePrismaClient();
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  const inTransaction: string[] = [];
  let running = false;
  const transactionRunner: TransactionRunner = {
    run: async <T>(work: () => Promise<T>) => {
      running = true;
      const result = await work();
      running = false;
      return result;
    },
  };
  const appended: AuditEventDraft[] = [];
  const auditTrail: AuditTrailPort = {
    append: (draft) => {
      appended.push(draft);
      inTransaction.push(
        running ? 'acte dans la transaction' : 'acte hors transaction',
      );
      return Promise.resolve();
    },
  };

  return {
    prisma,
    appended,
    inTransaction,
    repository: new PrismaServiceSettingsRepository(
      tenantConnection,
      transactionRunner,
      auditTrail,
    ),
  };
}

describe('PrismaServiceSettingsRepository', () => {
  it("écrit l'en-tête sous une clé fixe, pour n'avoir jamais qu'un seul jeu", async () => {
    const { repository, prisma } = build();

    await repository.save(
      ServiceSettings.reconstitute(SRPTS),
      SERVICE_HEADER_SAVED,
    );
    await repository.save(
      ServiceSettings.reconstitute({ ...SRPTS, signatureCity: 'Lyon' }),
      SERVICE_HEADER_SAVED,
    );

    const clés = prisma.upsertArgs.map((args) => args.where.id);
    expect(new Set(clés).size).toBe(1);
    expect(prisma.upsertArgs[0].create).toMatchObject({ id: clés[0] });
  });

  it('réécrit les six champs à la modification, pour qu’aucun ne se perde', async () => {
    const { repository, prisma } = build();

    await repository.save(
      ServiceSettings.reconstitute(SRPTS),
      SERVICE_HEADER_SAVED,
    );

    expect(prisma.upsertArgs[0].update).toEqual(SRPTS);
  });

  it("écrit les mêmes colonnes à la création qu'à la modification", async () => {
    const { repository, prisma } = build();

    await repository.save(
      ServiceSettings.reconstitute(SRPTS),
      SERVICE_HEADER_SAVED,
    );

    const [{ create, update }] = prisma.upsertArgs;
    const colonnesDeCréation = Object.keys(create).filter(
      (column) => column !== 'id',
    );
    expect(colonnesDeCréation.sort()).toEqual(Object.keys(update).sort());
  });

  it("écrit un champ vidé plutôt que de laisser l'ancienne valeur en place", async () => {
    const { repository, prisma } = build();

    await repository.save(
      ServiceSettings.reconstitute({ ...SRPTS, phoneNumber: '' }),
      SERVICE_HEADER_SAVED,
    );

    expect(prisma.upsertArgs[0].update).toMatchObject({ phoneNumber: '' });
  });

  it("inscrit l'acte dans la transaction qui écrit la ligne", async () => {
    const { repository, appended, inTransaction } = build();

    await repository.save(
      ServiceSettings.reconstitute(SRPTS),
      SERVICE_HEADER_SAVED,
    );

    expect(appended).toEqual([SERVICE_HEADER_SAVED]);
    expect(inTransaction).toEqual(['acte dans la transaction']);
  });

  it("relit l'en-tête enregistré sous la clé fixe", async () => {
    const { repository, prisma } = build();
    prisma.row = {
      id: 'peu importe',
      ...SRPTS,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
    };

    const found = await repository.find();

    expect(found!.toPrimitives()).toEqual(SRPTS);
    expect(prisma.findArgs[0].where.id).toBe('service-settings');
  });

  it("rend null quand le service n'a rien saisi", async () => {
    const { repository } = build();

    expect(await repository.find()).toBeNull();
  });
});
