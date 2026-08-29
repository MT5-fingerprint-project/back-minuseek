import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import type {
  CaseContributorData,
  CaseContributorsReader,
} from '../../application/ports/case-contributors.reader';
import { buildContributorList } from '../../application/queries/build-report/contributor-list';

@Injectable()
export class PrismaCaseContributorsReader implements CaseContributorsReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async read(caseId: string): Promise<CaseContributorData[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const events = await prisma.auditEvent.findMany({
      where: { caseId },
      select: { actor: true },
      orderBy: { seq: 'asc' },
    });

    const actors = events.map((event) => {
      const actor = event.actor as unknown as AuditActorPrimitives;
      return {
        type: actor.type,
        sub: actor.sub,
        displayName: actor.displayName,
      };
    });
    const subs = [...new Set(actors.map((actor) => actor.sub))];
    if (subs.length === 0) {
      return [];
    }

    const rows = await prisma.user.findMany({
      where: { identityProviderId: { in: subs } },
      include: { personalData: true },
    });

    return buildContributorList(
      actors,
      rows.map((row) => ({
        id: row.id,
        identityProviderId: row.identityProviderId,
        grade: row.grade,
        firstName: row.personalData.firstName,
        lastName: row.personalData.lastName,
      })),
    );
  }
}
