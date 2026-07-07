import { Global, Module } from '@nestjs/common';
import { AdminPrismaService } from './infrastructure/persistence/admin-prisma.service';
import { TenantConnectionService } from './infrastructure/persistence/tenant-connection.service';
import { TenantRegistryService } from './application/tenant-registry.service';
import { TenantContextService } from './application/tenant-context.service';

@Global()
@Module({
  providers: [
    AdminPrismaService,
    TenantRegistryService,
    TenantContextService,
    TenantConnectionService,
  ],
  exports: [
    AdminPrismaService,
    TenantRegistryService,
    TenantContextService,
    TenantConnectionService,
  ],
})
export class TenancyModule {}
