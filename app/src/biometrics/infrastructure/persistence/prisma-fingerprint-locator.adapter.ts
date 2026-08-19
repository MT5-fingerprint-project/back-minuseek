import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type {
  FingerprintLocation,
  FingerprintLocatorPort,
} from '../../application/ports/fingerprint-locator.port';

@Injectable()
export class PrismaFingerprintLocatorAdapter implements FingerprintLocatorPort {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async locate(fingerprintId: string): Promise<FingerprintLocation | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const trace = await prisma.trace.findUnique({
      where: { id: fingerprintId },
      select: { caseId: true },
    });
    if (trace) {
      return { caseId: trace.caseId, traceId: fingerprintId };
    }
    const referencePrint = await prisma.referencePrint.findUnique({
      where: { id: fingerprintId },
      select: { caseId: true },
    });
    if (referencePrint) {
      return { caseId: referencePrint.caseId, traceId: null };
    }
    return null;
  }
}
