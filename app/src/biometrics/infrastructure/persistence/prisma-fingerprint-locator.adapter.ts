import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { NOT_WITHDRAWN } from '../../../shared/infrastructure/persistence/withdrawal';
import type {
  FingerprintLocation,
  FingerprintLocatorPort,
} from '../../application/ports/fingerprint-locator.port';

@Injectable()
export class PrismaFingerprintLocatorAdapter implements FingerprintLocatorPort {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async locate(fingerprintId: string): Promise<FingerprintLocation | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    // `findUnique` n'accepte que des champs uniques : filtrer le retrait par
    // identifiant impose `findFirst`.
    const trace = await prisma.trace.findFirst({
      where: { id: fingerprintId, ...NOT_WITHDRAWN },
      select: { caseId: true },
    });
    if (trace) {
      return { caseId: trace.caseId, traceId: fingerprintId };
    }
    const referencePrint = await prisma.referencePrint.findFirst({
      where: { id: fingerprintId, ...NOT_WITHDRAWN },
      select: { caseId: true },
    });
    if (referencePrint) {
      return { caseId: referencePrint.caseId, traceId: null };
    }
    return null;
  }
}
