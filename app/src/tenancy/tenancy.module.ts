import { Global, Module } from '@nestjs/common';
import { AdminPrismaService } from './infrastructure/persistence/admin-prisma.service';
import { TenantConnectionService } from './infrastructure/persistence/tenant-connection.service';
import { TransactionContextService } from './infrastructure/persistence/transaction-context.service';
import { PrismaTransactionRunner } from './infrastructure/persistence/prisma-transaction-runner';
import { TenantRegistryService } from './application/tenant-registry.service';
import { TenantContextService } from './application/tenant-context.service';
import { TRANSACTION_RUNNER } from '../shared/domain/ports/transaction-runner';

@Global()
@Module({
  providers: [
    AdminPrismaService,
    TenantRegistryService,
    TenantContextService,
    TenantConnectionService,
    TransactionContextService,
    {
      provide: TRANSACTION_RUNNER,
      useClass: PrismaTransactionRunner,
    },
  ],
  exports: [
    AdminPrismaService,
    TenantRegistryService,
    TenantContextService,
    TenantConnectionService,
    TransactionContextService,
    TRANSACTION_RUNNER,
  ],
})
export class TenancyModule {}
