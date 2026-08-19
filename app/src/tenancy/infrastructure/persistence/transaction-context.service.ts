import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../../../generated/prisma/client';
import { TransactionMutationJournal } from './transaction-mutation-journal';

export interface TransactionScope {
  transaction: Prisma.TransactionClient;
  journal: TransactionMutationJournal;
}

/**
 * Contexte transactionnel, calqué sur TenantContextService : le
 * runner y dépose le client transactionnel Prisma, et
 * TenantConnectionService#getCurrentClient le restitue aux repositories —
 * qui participent ainsi à la transaction sans être modifiés.
 */
@Injectable()
export class TransactionContextService {
  private static readonly storage = new AsyncLocalStorage<TransactionScope>();

  run<T>(
    transaction: Prisma.TransactionClient,
    callback: (scope: TransactionScope) => T,
  ): T {
    const scope: TransactionScope = {
      transaction,
      journal: new TransactionMutationJournal(),
    };
    return TransactionContextService.storage.run(scope, () => callback(scope));
  }

  getCurrentTransaction(): Prisma.TransactionClient | undefined {
    return TransactionContextService.storage.getStore()?.transaction;
  }

  getCurrentJournal(): TransactionMutationJournal | undefined {
    return TransactionContextService.storage.getStore()?.journal;
  }
}
