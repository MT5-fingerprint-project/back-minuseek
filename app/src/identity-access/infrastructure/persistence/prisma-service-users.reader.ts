import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { ServiceUsersFilters } from '../../application/queries/list-users/service-users-filters';
import type { ServiceUsersReader } from '../../application/queries/list-users/service-users.reader';

@Injectable()
export class PrismaServiceUsersReader implements ServiceUsersReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findAll(
    filters: ServiceUsersFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ items: ServiceUserReadModel[]; total: number }> {
    const prisma = await this.tenantConnection.getCurrentClient();
    // La même clause pour la page et pour le total : deux clauses distinctes
    // fausseraient le nombre de pages, donc la dernière page de la liste.
    const where = whereFrom(filters);

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
      prisma.user.count({ where }),
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

function whereFrom(filters: ServiceUsersFilters) {
  const search = escapeLikeWildcards(filters.search?.trim());

  return {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.grade ? { grade: filters.grade } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(search
      ? {
          OR: [
            {
              personalData: {
                lastName: { contains: search, mode: 'insensitive' as const },
              },
            },
            {
              personalData: {
                firstName: { contains: search, mode: 'insensitive' as const },
              },
            },
            {
              serviceNumber: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  };
}

/** Le fragment cherché est une saisie, pas un motif : sans cet échappement,
 * « % » rendrait tout le service et « PTS_0002 » trouverait « PTS-0002 ».
 * L'antislash est le caractère d'échappement par défaut de LIKE en Postgres. */
function escapeLikeWildcards(search: string | undefined): string | undefined {
  return search?.replace(/[\\%_]/g, '\\$&');
}
