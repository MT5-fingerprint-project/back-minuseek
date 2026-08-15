import type { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from './tenant-connection.service';
import { TransactionContextService } from './transaction-context.service';
import { PrismaTransactionRunner } from './prisma-transaction-runner';

class FakeTenantClient {
  openedTransactions = 0;
  readonly transactionClient = {
    label: 'tx',
  } as unknown as Prisma.TransactionClient;

  $transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.openedTransactions += 1;
    return work(this.transactionClient);
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
