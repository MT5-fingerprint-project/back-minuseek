import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { RecipientBookEntry } from '../../domain/recipient-book-entry/entity/recipient-book-entry';
import type { RecipientBookEntryRepository } from '../../domain/recipient-book-entry/repository/recipient-book-entry.repository';

@Injectable()
export class PrismaRecipientBookEntryRepository implements RecipientBookEntryRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(entry: RecipientBookEntry): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const p = entry.toPrimitives();
    const columns = {
      authority: p.authority,
      attentionQuality: p.attentionQuality,
      attentionName: p.attentionName,
      updatedAt: p.updatedAt,
    };
    await prisma.recipientBookEntry.upsert({
      where: { id: p.id },
      create: { id: p.id, createdAt: p.createdAt, ...columns },
      update: columns,
    });
  }

  async findById(id: string): Promise<RecipientBookEntry | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.recipientBookEntry.findUnique({ where: { id } });
    return row ? RecipientBookEntry.reconstitute(row) : null;
  }

  async delete(id: string): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.recipientBookEntry.delete({ where: { id } });
  }
}
