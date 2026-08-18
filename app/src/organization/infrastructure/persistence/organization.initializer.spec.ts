import type { PrismaClient } from '../../../../generated/prisma/client';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { AuditActorTypeEnum } from '../../../shared/domain/audit/audit-actor.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import { GENESIS_PREV_HASH } from '../../../audit-trail/domain/audit-event/entity/audit-event';
import { PrismaAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/prisma-audit-trail.appender';
import { TransactionContextService } from '../../../tenancy/infrastructure/persistence/transaction-context.service';
import { OrganizationToInitialize } from '../../application/ports/organization-initializer.port';
import { OrganizationInitializer } from './organization.initializer';

const LABO_LYON: OrganizationToInitialize = {
  databaseName: 'minuseek_labo_lyon',
  slug: 'labo-lyon',
  displayName: 'PTS Lyon',
  realm: 'minuseek-labo-lyon',
};

interface OrganizationRow {
  id: string;
  slug: string;
  displayName: string;
}

interface AuditEventRow {
  seq: bigint;
  eventType: string;
  evidenceClass: string;
  actor: { type: string; username: string };
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

class FakeTenantClient {
  readonly organizationRows: OrganizationRow[] = [];
  readonly auditEventRows: AuditEventRow[] = [];
  openTransactions = 0;

  $transaction<T>(
    work: (transaction: FakeTenantClient) => Promise<T>,
  ): Promise<T> {
    this.openTransactions += 1;
    return work(this);
  }

  $queryRaw(): Promise<unknown> {
    return Promise.resolve([]);
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }

  readonly organization = {
    findFirst: (): Promise<OrganizationRow | null> =>
      Promise.resolve(this.organizationRows.at(0) ?? null),
    create: (args: { data: OrganizationRow }): Promise<OrganizationRow> => {
      this.organizationRows.push(args.data);
      return Promise.resolve(args.data);
    },
  };

  readonly auditEvent = {
    findFirst: (): Promise<AuditEventRow | null> =>
      Promise.resolve(this.auditEventRows.at(-1) ?? null),
    create: (args: { data: AuditEventRow }): Promise<AuditEventRow> => {
      this.auditEventRows.push(args.data);
      return Promise.resolve(args.data);
    },
  };
}

class TestableOrganizationInitializer extends OrganizationInitializer {
  constructor(
    private readonly client: FakeTenantClient,
    transactionContext: TransactionContextService,
    appender: PrismaAuditTrailAppender,
  ) {
    super(transactionContext, appender);
  }

  protected override instantiateClient(): PrismaClient {
    return this.client as unknown as PrismaClient;
  }
}

function buildInitializer() {
  const client = new FakeTenantClient();
  const transactionContext = new TransactionContextService();
  const appender = new PrismaAuditTrailAppender(transactionContext, {
    generate: () => 'audit-event-uuid',
  });
  return {
    client,
    initializer: new TestableOrganizationInitializer(
      client,
      transactionContext,
      appender,
    ),
  };
}

describe('OrganizationInitializer', () => {
  beforeAll(() => {
    process.env.TENANT_DATABASE_URL_TEMPLATE =
      'postgresql://minuseek:minuseek@localhost:5432/{db}';
  });

  it("crée l'organisation de la base fraîchement provisionnée", async () => {
    const { initializer, client } = buildInitializer();

    await initializer.initialize(LABO_LYON);

    expect(client.organizationRows).toHaveLength(1);
    expect(client.organizationRows[0]).toMatchObject({
      slug: 'labo-lyon',
      displayName: 'PTS Lyon',
    });
  });

  it('ouvre la chaîne du tenant sur un genesis TENANT_PROVISIONED', async () => {
    const { initializer, client } = buildInitializer();

    await initializer.initialize(LABO_LYON);

    expect(client.auditEventRows).toHaveLength(1);
    const [genesis] = client.auditEventRows;
    expect(genesis.seq).toBe(1n);
    expect(genesis.prevHash).toBe(GENESIS_PREV_HASH);
    expect(genesis.eventType).toBe(AuditEventTypeEnum.TENANT_PROVISIONED);
    expect(genesis.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(genesis.actor).toMatchObject({
      type: AuditActorTypeEnum.SYSTEM,
      username: 'provisioner',
    });
    expect(genesis.payload).toEqual({
      slug: 'labo-lyon',
      displayName: 'PTS Lyon',
      realm: 'minuseek-labo-lyon',
    });
  });

  it("écrit l'organisation et son genesis dans une seule transaction", async () => {
    const { initializer, client } = buildInitializer();

    await initializer.initialize(LABO_LYON);

    expect(client.openTransactions).toBe(1);
  });

  it('reste idempotent : une base déjà initialisée ne rechaîne rien', async () => {
    const { initializer, client } = buildInitializer();

    await initializer.initialize(LABO_LYON);
    await initializer.initialize(LABO_LYON);

    expect(client.organizationRows).toHaveLength(1);
    expect(client.auditEventRows).toHaveLength(1);
  });
});
