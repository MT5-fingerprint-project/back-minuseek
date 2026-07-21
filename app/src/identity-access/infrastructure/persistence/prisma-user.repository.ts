import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { UserRole as PrismaUserRole } from '../../../../generated/prisma/enums';
import { User } from '../../domain/user/entity/user';
import type { UserRepository } from '../../domain/user/repository/user.repository';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(user: User): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const p = user.toPrimitives();
    await prisma.user.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        identityProviderId: p.identityProviderId,
        role: p.role as PrismaUserRole,
        grade: p.grade,
        serviceNumber: p.serviceNumber,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        personalData: {
          create: { firstName: p.firstName, lastName: p.lastName },
        },
      },
      update: {
        role: p.role as PrismaUserRole,
        grade: p.grade,
        serviceNumber: p.serviceNumber,
        updatedAt: p.updatedAt,
        personalData: {
          update: { firstName: p.firstName, lastName: p.lastName },
        },
      },
    });
  }

  async existsByIdentityProviderId(
    identityProviderId: string,
  ): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.user.findUnique({
      where: { identityProviderId },
      select: { id: true },
    });
    return found !== null;
  }

  async existsByServiceNumber(serviceNumber: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.user.findUnique({
      where: { serviceNumber },
      select: { id: true },
    });
    return found !== null;
  }
}
