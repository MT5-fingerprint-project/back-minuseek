import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';
import { TenantConnectionService } from './tenant-connection.service';
import { TransactionContextService } from './transaction-context.service';

@Injectable()
export class PrismaTransactionRunner implements TransactionRunner {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.transactionContext.getCurrentTransaction()) {
      return work();
    }
    const client = await this.tenantConnection.getCurrentClient();
    return client.$transaction(async (transaction) =>
      this.transactionContext.run(transaction, work),
    );
  }
}
