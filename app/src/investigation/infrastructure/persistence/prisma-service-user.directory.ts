import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { ServiceUserDirectory } from '../../application/ports/service-user.directory';

@Injectable()
export class PrismaServiceUserDirectory implements ServiceUserDirectory {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async exists(userId: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return found !== null;
  }
}
