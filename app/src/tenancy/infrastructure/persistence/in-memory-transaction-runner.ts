import { TransactionRunner } from '../../../shared/domain/ports/transaction-runner';

export class InMemoryTransactionRunner implements TransactionRunner {
  runCount = 0;

  run<T>(work: () => Promise<T>): Promise<T> {
    this.runCount += 1;
    return work();
  }
}
