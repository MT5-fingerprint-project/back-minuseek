import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import type { ServiceUsersReader } from '../../application/queries/list-users/service-users.reader';

@Injectable()
export class PrismaServiceUsersReader implements ServiceUsersReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findAll(pagination: {
    skip: number;
    take: number;
  }): Promise<{ items: ServiceUserReadModel[]; total: number }> {
    const prisma = await this.tenantConnection.getCurrentClient();

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        skip: pagination.skip,
        take: pagination.take,
        // L'identifiant départage les homonymes : sans lui, deux pages
        // successives peuvent rendre deux fois la même ligne.
        orderBy: [
          { personalData: { lastName: 'asc' } },
          { personalData: { firstName: 'asc' } },
          { id: 'asc' },
        ],
        include: { personalData: true },
      }),
      prisma.user.count(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        firstName: row.personalData.firstName,
        lastName: row.personalData.lastName,
        role: row.role,
        grade: row.grade,
        serviceNumber: row.serviceNumber,
        status: row.status,
      })),
      total,
    };
  }
}
