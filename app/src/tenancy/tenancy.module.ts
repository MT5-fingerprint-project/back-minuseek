import { Global, Module } from '@nestjs/common';
import { AdminPrismaService } from './infrastructure/persistence/admin-prisma.service';
import { TenantRegistryService } from './application/tenant-registry.service';

@Global()
@Module({
  providers: [AdminPrismaService, TenantRegistryService],
  exports: [AdminPrismaService, TenantRegistryService],
})
export class TenancyModule {}
