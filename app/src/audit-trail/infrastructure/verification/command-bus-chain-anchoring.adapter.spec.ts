import { CommandBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import type { AnchoringOutcome } from '../../application/commands/anchor-chain/anchor-chain.handler';
import {
  AdminSealRegistry,
  NoTenantForSealError,
} from '../persistence/admin-seal-registry';
import { CommandBusChainAnchoring } from './command-bus-chain-anchoring.adapter';

const GEN_TIME = new Date('2026-08-31T03:00:00.000Z');

interface MarkCall {
  tenantSlug: string;
  coveredThroughSeq: bigint;
  anchoredAt: Date;
}

function build(outcome: AnchoringOutcome) {
  const marks: MarkCall[] = [];
  const sealRegistry = {
    markAnchored: (
      tenantSlug: string,
      coveredThroughSeq: bigint,
      anchoredAt: Date,
    ) => {
      marks.push({ tenantSlug, coveredThroughSeq, anchoredAt });
      return Promise.resolve(marks.length);
    },
  } as unknown as AdminSealRegistry;
  const commandBus = {
    execute: () => Promise.resolve(outcome),
  } as unknown as CommandBus;
  const tenantContext = new TenantContextService();

  return {
    marks,
    tenantContext,
    anchoring: new CommandBusChainAnchoring(
      commandBus,
      tenantContext,
      sealRegistry,
    ),
  };
}

describe('CommandBusChainAnchoring', () => {
  it('marque les scellés couverts avec la séquence et l’heure rendues par l’ancrage', async () => {
    const { anchoring, tenantContext, marks } = build({
      status: 'anchored',
      headSeq: 40,
      genTime: GEN_TIME,
    });

    await tenantContext.run({ slug: 'demo' }, () => anchoring.anchor());

    expect(marks).toEqual([
      {
        tenantSlug: 'demo',
        coveredThroughSeq: 40n,
        anchoredAt: GEN_TIME,
      },
    ]);
  });

  it('ne marque rien quand rien de neuf n’était à ancrer', async () => {
    const { anchoring, tenantContext, marks } = build({
      status: 'skipped',
      reason: 'rien de neuf depuis la dernière ancre',
    });

    await tenantContext.run({ slug: 'demo' }, () => anchoring.anchor());

    expect(marks).toEqual([]);
  });

  it('ne marque rien quand la chaîne est vide', async () => {
    const { anchoring, tenantContext, marks } = build({
      status: 'skipped',
      reason: 'chaîne vide',
    });

    await tenantContext.run({ slug: 'demo' }, () => anchoring.anchor());

    expect(marks).toEqual([]);
  });

  it('refuse de marquer hors du contexte d’un laboratoire', async () => {
    const { anchoring, marks } = build({
      status: 'anchored',
      headSeq: 40,
      genTime: GEN_TIME,
    });

    await expect(anchoring.anchor()).rejects.toThrow(NoTenantForSealError);
    expect(marks).toEqual([]);
  });
});
