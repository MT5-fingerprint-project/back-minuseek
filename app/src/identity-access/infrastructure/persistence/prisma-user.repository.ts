import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  UserRole as PrismaUserRole,
  UserStatus as PrismaUserStatus,
} from '../../../../generated/prisma/enums';
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
        status: p.status as PrismaUserStatus,
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
        status: p.status as PrismaUserStatus,
        updatedAt: p.updatedAt,
        personalData: {
          update: { firstName: p.firstName, lastName: p.lastName },
        },
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.user.findUnique({
      where: { id },
      include: { personalData: true },
    });
    if (!row) {
      return null;
    }
    return User.reconstitute({
      id: row.id,
      identityProviderId: row.identityProviderId,
      role: row.role,
      grade: row.grade,
      serviceNumber: row.serviceNumber,
      status: row.status,
      firstName: row.personalData.firstName,
      lastName: row.personalData.lastName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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
