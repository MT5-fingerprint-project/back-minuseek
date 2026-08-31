import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { ChainAnchoringPort } from '../../../shared/domain/ports/chain-anchoring.port';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { AnchorChainCommand } from '../../application/commands/anchor-chain/anchor-chain.command';
import type { AnchoringOutcome } from '../../application/commands/anchor-chain/anchor-chain.handler';
import {
  AdminSealRegistry,
  NoTenantForSealError,
} from '../persistence/admin-seal-registry';

@Injectable()
export class CommandBusChainAnchoring implements ChainAnchoringPort {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tenantContext: TenantContextService,
    private readonly sealRegistry: AdminSealRegistry,
  ) {}

  async anchor(): Promise<void> {
    const outcome = await this.commandBus.execute<
      AnchorChainCommand,
      AnchoringOutcome
    >(new AnchorChainCommand());
    if (outcome.status !== 'anchored') {
      return;
    }

    // Sans ce marquage, la page publique n'affiche aucune date sur les scellés couverts.
    const tenantSlug = this.tenantContext.getCurrentTenant();
    if (!tenantSlug) {
      throw new NoTenantForSealError();
    }
    await this.sealRegistry.markAnchored(
      tenantSlug,
      BigInt(outcome.headSeq),
      outcome.genTime,
    );
  }
}
