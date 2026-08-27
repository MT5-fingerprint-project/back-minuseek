import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { ServiceUserGradesReader } from '../../application/queries/list-user-grades/service-user-grades.reader';

@Injectable()
export class PrismaServiceUserGradesReader implements ServiceUserGradesReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async listGrades(): Promise<string[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.user.findMany({
      distinct: ['grade'],
      select: { grade: true },
      orderBy: { grade: 'asc' },
    });
    return rows.map((row) => row.grade);
  }
}
