import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';
import { TenantConnectionService } from './tenant-connection.service';
import { TransactionContextService } from './transaction-context.service';
import { UnauditedMutationError } from './unaudited-mutation.error';

@Injectable()
export class PrismaTransactionRunner implements TransactionRunner {
  private readonly observedClients = new WeakMap<PrismaClient, PrismaClient>();

  constructor(
    private readonly tenantConnection: TenantConnectionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.transactionContext.getCurrentTransaction()) {
      return work();
    }
    const client = await this.tenantConnection.getCurrentClient();
    return this.observing(client).$transaction(async (transaction) =>
      this.transactionContext.run(transaction, async (scope) => {
        const result = await work();
        const unchained = scope.journal.unchainedTables();
        if (unchained.length > 0) {
          throw new UnauditedMutationError(unchained);
        }
        return result;
      }),
    );
  }

  /**
   L'extension est posée une fois par client et lit le journal dans l'ALS : une seule instance étendue sert toutes les transactions du tenant.
   */
  private observing(client: PrismaClient): PrismaClient {
    const alreadyObserved = this.observedClients.get(client);
    if (alreadyObserved) {
      return alreadyObserved;
    }
    const observed = client.$extends({
      query: {
        $allOperations: ({ model, operation, args, query }) => {
          this.transactionContext.getCurrentJournal()?.record(model, operation);
          return query(args);
        },
      },
    }) as unknown as PrismaClient;
    this.observedClients.set(client, observed);
    return observed;
  }
}
