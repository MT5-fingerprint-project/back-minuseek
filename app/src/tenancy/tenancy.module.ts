import { Global, Module } from '@nestjs/common';
import { AdminPrismaService } from './infrastructure/persistence/admin-prisma.service';
import { TenantRegistryService } from './application/tenant-registry.service';
import { TenantContextService } from './application/tenant-context.service';

@Global()
@Module({
  providers: [AdminPrismaService, TenantRegistryService, TenantContextService],
  exports: [AdminPrismaService, TenantRegistryService, TenantContextService],
})
export class TenancyModule {}
