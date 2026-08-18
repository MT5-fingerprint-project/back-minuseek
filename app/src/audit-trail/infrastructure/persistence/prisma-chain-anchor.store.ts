import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { TransactionContextService } from '../../../tenancy/infrastructure/persistence/transaction-context.service';
import type {
  ChainAnchorRecord,
  ChainAnchorStore,
  ChainAnchorToSave,
} from '../../application/ports/chain-anchor.store';
import { AuditAppendOutsideTransactionError } from './audit-append-outside-transaction.error';

const GRANTED = 'GRANTED';

interface AnchorRow {
  headSeq: bigint;
  headHash: string;
  tsaUrl: string;
  tsaResponse: Uint8Array;
  anchoredAt: Date;
}

function toRecord(row: AnchorRow): ChainAnchorRecord {
  return {
    headSeq: row.headSeq,
    headHash: row.headHash,
    tsaUrl: row.tsaUrl,
    tsaResponse: Buffer.from(row.tsaResponse),
    anchoredAt: row.anchoredAt,
  };
}

@Injectable()
export class PrismaChainAnchorStore implements ChainAnchorStore {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  async findLast(): Promise<ChainAnchorRecord | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.auditAnchor.findFirst({
      orderBy: [{ headSeq: 'desc' }, { id: 'desc' }],
    });
    return row ? toRecord(row) : null;
  }

  async list(): Promise<ChainAnchorRecord[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.auditAnchor.findMany({
      orderBy: [{ headSeq: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async save(anchor: ChainAnchorToSave): Promise<void> {
    const transaction = this.transactionContext.getCurrentTransaction();
    if (!transaction) {
      throw new AuditAppendOutsideTransactionError('CHAIN_ANCHORED');
    }
    await transaction.auditAnchor.create({
      data: {
        id: anchor.id,
        headSeq: anchor.headSeq,
        headHash: anchor.headHash,
        tsaUrl: anchor.tsaUrl,
        tsaResponse: new Uint8Array(anchor.tsaResponse),
        anchoredAt: anchor.anchoredAt,
        status: GRANTED,
      },
    });
  }
}
