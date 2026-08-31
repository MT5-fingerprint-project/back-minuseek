import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { RecipientBookEntriesReader } from '../../application/queries/list-recipient-book-entries/recipient-book-entries.reader';
import { RecipientBookEntryReadModel } from '../../application/queries/list-recipient-book-entries/recipient-book-entry-read-model';

@Injectable()
export class PrismaRecipientBookEntriesReader implements RecipientBookEntriesReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findAll(): Promise<RecipientBookEntryReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.recipientBookEntry.findMany({
      select: {
        id: true,
        authority: true,
        attentionQuality: true,
        attentionName: true,
      },
      // `authority` n'est pas unique : sans départage, deux fiches homonymes
      // changeraient de place d'un appel à l'autre.
      orderBy: [{ authority: 'asc' }, { id: 'asc' }],
    });
  }
}
