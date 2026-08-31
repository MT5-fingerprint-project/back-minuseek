import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { cloudflareClientIp } from '../shared/infrastructure/http/cloudflare-client-ip';
import { AUDIT_TRAIL } from '../shared/domain/ports/audit-trail.port';
import { CHAIN_ANCHORING } from '../shared/domain/ports/chain-anchoring.port';
import { PUBLIC_SEAL_READER } from './application/ports/public-seal.reader';
import { SEAL_REGISTRY } from '../shared/domain/ports/seal-registry.port';
import { AnchorChainHandler } from './application/commands/anchor-chain/anchor-chain.handler';
import { FindSealHandler } from './application/queries/find-seal/find-seal.handler';
import { CHAIN_ANCHOR_STORE } from './application/ports/chain-anchor.store';
import { TIMESTAMP_AUTHORITY } from './application/ports/timestamp-authority.port';
import { TIMESTAMP_VERIFIER } from './application/ports/timestamp-verifier.port';
import { CASE_AUDIT_EVENT_READER } from './application/queries/list-case-audit-events/case-audit-event.reader';
import { ListCaseAuditEventsHandler } from './application/queries/list-case-audit-events/list-case-audit-events.handler';
import { CHAIN_EVENT_READER } from './application/queries/verify-chain/chain-event.reader';
import { VerifyChainHandler } from './application/queries/verify-chain/verify-chain.handler';
import { AuditTrailController } from './infrastructure/http/audit-trail.controller';
import { InternalAuditController } from './infrastructure/http/internal-audit.controller';
import { PublicSealController } from './infrastructure/http/public-seal.controller';
import { AdminPublicSealReader } from './infrastructure/persistence/admin-public-seal.reader';
import { AdminSealRegistry } from './infrastructure/persistence/admin-seal-registry';
import { PrismaAuditTrailAppender } from './infrastructure/persistence/prisma-audit-trail.appender';
import { PrismaSealSourceReader } from './infrastructure/persistence/prisma-seal-source.reader';
import { PrismaCaseAuditEventReader } from './infrastructure/persistence/prisma-case-audit-event.reader';
import { PrismaChainAnchorStore } from './infrastructure/persistence/prisma-chain-anchor.store';
import { PrismaChainEventReader } from './infrastructure/persistence/prisma-chain-event.reader';
import { Rfc3161TimestampVerifier } from './infrastructure/tsa/rfc3161-timestamp.verifier';
import { Rfc3161TsaAdapter } from './infrastructure/tsa/rfc3161-tsa.adapter';
import { CommandBusChainAnchoring } from './infrastructure/verification/command-bus-chain-anchoring.adapter';
import { TenantChainAnchoringRunner } from './infrastructure/verification/tenant-chain-anchoring.runner';
import { TenantChainVerificationRunner } from './infrastructure/verification/tenant-chain-verification.runner';
import { TenantSealProjectionRunner } from './infrastructure/verification/tenant-seal-projection.runner';

@Module({
  imports: [
    CqrsModule,
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 30 }],
      getTracker: (request: Record<string, unknown>) =>
        Promise.resolve(cloudflareClientIp(request as unknown as Request)),
    }),
  ],
  controllers: [
    AuditTrailController,
    InternalAuditController,
    PublicSealController,
  ],
  providers: [
    ListCaseAuditEventsHandler,
    VerifyChainHandler,
    AnchorChainHandler,
    FindSealHandler,
    TenantChainVerificationRunner,
    TenantChainAnchoringRunner,
    TenantSealProjectionRunner,
    PrismaSealSourceReader,
    AdminSealRegistry,
    {
      provide: SEAL_REGISTRY,
      useExisting: AdminSealRegistry,
    },
    {
      provide: CHAIN_ANCHORING,
      useClass: CommandBusChainAnchoring,
    },
    {
      provide: PUBLIC_SEAL_READER,
      useClass: AdminPublicSealReader,
    },
    {
      provide: AUDIT_TRAIL,
      useClass: PrismaAuditTrailAppender,
    },
    {
      provide: CASE_AUDIT_EVENT_READER,
      useClass: PrismaCaseAuditEventReader,
    },
    {
      provide: CHAIN_EVENT_READER,
      useClass: PrismaChainEventReader,
    },
    {
      provide: CHAIN_ANCHOR_STORE,
      useClass: PrismaChainAnchorStore,
    },
    {
      provide: TIMESTAMP_AUTHORITY,
      useClass: Rfc3161TsaAdapter,
    },
    {
      provide: TIMESTAMP_VERIFIER,
      useClass: Rfc3161TimestampVerifier,
    },
  ],
  exports: [AUDIT_TRAIL, SEAL_REGISTRY, CHAIN_ANCHORING],
})
export class AuditTrailModule {}
