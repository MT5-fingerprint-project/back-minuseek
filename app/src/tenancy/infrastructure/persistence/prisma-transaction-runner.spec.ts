import type { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from './tenant-connection.service';
import { TransactionContextService } from './transaction-context.service';
import { PrismaTransactionRunner } from './prisma-transaction-runner';
import { UNAUDITED_TABLES } from '../../../shared/domain/audit/unaudited-tables';
import { UnauditedMutationError } from './unaudited-mutation.error';

const [AN_EXEMPTED_TABLE] = Object.keys(UNAUDITED_TABLES);

interface ObservedOperation {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

class FakeTenantClient {
  openedTransactions = 0;
  private observe?: (operation: ObservedOperation) => Promise<unknown>;

  readonly transactionClient = {
    label: 'tx',
  } as unknown as Prisma.TransactionClient;

  $extends(extension: {
    query: {
      $allOperations: (operation: ObservedOperation) => Promise<unknown>;
    };
  }): FakeTenantClient {
    this.observe = extension.query.$allOperations;
    return this;
  }

  $transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.openedTransactions += 1;
    return work(this.transactionClient);
  }

  /** Rejoue une opération Prisma telle que l'extension la verrait. */
  emit(model: string | undefined, operation: string): Promise<unknown> {
    if (!this.observe) {
      throw new Error("le runner n'a pas posé d'extension d'observation");
    }
    return this.observe({
      model,
      operation,
      args: {},
      query: () => Promise.resolve(null),
    });
  }
}

function buildRunner() {
  const client = new FakeTenantClient();
  const transactionContext = new TransactionContextService();
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(client as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  const runner = new PrismaTransactionRunner(
    tenantConnection,
    transactionContext,
  );
  return { runner, client, transactionContext };
}

describe('PrismaTransactionRunner', () => {
  it('ouvre une transaction et expose le client transactionnel pendant work', async () => {
    const { runner, client, transactionContext } = buildRunner();

    const observed = await runner.run(() =>
      Promise.resolve(transactionContext.getCurrentTransaction()),
    );

    expect(observed).toBe(client.transactionClient);
    expect(client.openedTransactions).toBe(1);
  });

  it('retourne la valeur de work', async () => {
    const { runner } = buildRunner();
    await expect(runner.run(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it('un run imbriqué rejoint la transaction ambiante (pas de seconde transaction)', async () => {
    const { runner, client, transactionContext } = buildRunner();

    const observed = await runner.run(() =>
      runner.run(() =>
        Promise.resolve(transactionContext.getCurrentTransaction()),
      ),
    );

    expect(observed).toBe(client.transactionClient);
    expect(client.openedTransactions).toBe(1);
  });

  it("propage l'erreur de work sans l'avaler", async () => {
    const { runner, transactionContext } = buildRunner();
    const failure = new Error('métier en échec');

    await expect(runner.run(() => Promise.reject(failure))).rejects.toBe(
      failure,
    );
    expect(transactionContext.getCurrentTransaction()).toBeUndefined();
  });

  it('nettoie le contexte après un run réussi', async () => {
    const { runner, transactionContext } = buildRunner();

    await runner.run(() => Promise.resolve());

    expect(transactionContext.getCurrentTransaction()).toBeUndefined();
  });
});

describe('PrismaTransactionRunner — garde fail-closed', () => {
  it('refuse une mutation métier qui ne laisse aucun maillon dans la chaîne', async () => {
    const { runner, client } = buildRunner();

    await expect(
      runner.run(async () => {
        await client.emit('Organization', 'create');
      }),
    ).rejects.toThrow(UnauditedMutationError);
  });

  it('nomme la table fautive pour que le développeur sache quoi instrumenter', async () => {
    const { runner, client } = buildRunner();

    await expect(
      runner.run(async () => {
        await client.emit('Organization', 'create');
      }),
    ).rejects.toThrow(/Organization/);
  });

  it('laisse passer la mutation accompagnée de son maillon', async () => {
    const { runner, client } = buildRunner();

    await expect(
      runner.run(async () => {
        await client.emit('Organization', 'create');
        await client.emit('AuditEvent', 'create');
        return 'commité';
      }),
    ).resolves.toBe('commité');
  });

  it('laisse passer une transaction qui ne fait que lire', async () => {
    const { runner, client } = buildRunner();

    await expect(
      runner.run(async () => {
        await client.emit('Organization', 'findMany');
      }),
    ).resolves.toBeUndefined();
  });

  it('laisse passer une table encore exemptée', async () => {
    const { runner, client } = buildRunner();

    await expect(
      runner.run(async () => {
        await client.emit(AN_EXEMPTED_TABLE, 'create');
      }),
    ).resolves.toBeUndefined();
  });

  it("compte les mutations transaction par transaction, sans fuite d'une à l'autre", async () => {
    const { runner, client } = buildRunner();

    await expect(
      runner.run(async () => {
        await client.emit('Organization', 'create');
        await client.emit('AuditEvent', 'create');
      }),
    ).resolves.toBeUndefined();

    await expect(
      runner.run(async () => {
        await client.emit('Organization', 'create');
      }),
    ).rejects.toThrow(UnauditedMutationError);
  });

  it('ne compte pas les opérations émises hors de toute transaction', async () => {
    const { runner, client } = buildRunner();

    await runner.run(() => Promise.resolve());
    await expect(client.emit('Organization', 'create')).resolves.toBeNull();
  });
});
