import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import type { UserReader } from '../../application/queries/get-user-by-provider-id/user.reader';

@Injectable()
export class PrismaUserReader implements UserReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByIdentityProviderId(
    identityProviderId: string,
  ): Promise<UserReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.user.findUnique({
      where: { identityProviderId },
      include: { personalData: true },
    });
    if (!row) return null;

    return {
      id: row.id,
      identityProviderId: row.identityProviderId,
      role: row.role,
      grade: row.grade,
      serviceNumber: row.serviceNumber,
      firstName: row.personalData.firstName,
      lastName: row.personalData.lastName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
