import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../../../generated/prisma/client';

/**
 * Contexte transactionnel, calqué sur TenantContextService : le
 * runner y dépose le client transactionnel Prisma, et
 * TenantConnectionService#getCurrentClient le restitue aux repositories —
 * qui participent ainsi à la transaction sans être modifiés.
 */
@Injectable()
export class TransactionContextService {
  private static readonly storage =
    new AsyncLocalStorage<Prisma.TransactionClient>();

  run<T>(transaction: Prisma.TransactionClient, callback: () => T): T {
    return TransactionContextService.storage.run(transaction, callback);
  }

  getCurrentTransaction(): Prisma.TransactionClient | undefined {
    return TransactionContextService.storage.getStore();
  }
}
