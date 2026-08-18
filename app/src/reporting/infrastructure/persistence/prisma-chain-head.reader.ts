import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type {
  ChainHeadReader,
  ChainHeadSummary,
} from '../../application/ports/chain-head.reader';

@Injectable()
export class PrismaChainHeadReader implements ChainHeadReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async read(): Promise<ChainHeadSummary | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const head = await prisma.auditEvent.findFirst({
      orderBy: { seq: 'desc' },
      select: { seq: true, hash: true },
    });
    return head ? { seq: Number(head.seq), hash: head.hash } : null;
  }
}
