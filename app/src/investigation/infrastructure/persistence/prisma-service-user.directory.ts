import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type {
  DesignatableServiceUser,
  ServiceUserDirectory,
} from '../../application/ports/service-user.directory';

@Injectable()
export class PrismaServiceUserDirectory implements ServiceUserDirectory {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  // L'état est sélectionné, pas filtré : un compte désactivé doit se
  // distinguer d'un compte inexistant, les deux refus n'ont pas le même remède.
  async findById(userId: string): Promise<DesignatableServiceUser | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        personalData: { select: { firstName: true, lastName: true } },
      },
    });
    if (!found) {
      return null;
    }
    return {
      id: found.id,
      disabled: found.status !== 'ACTIVE',
      firstName: found.personalData.firstName,
      lastName: found.personalData.lastName,
    };
  }
}
