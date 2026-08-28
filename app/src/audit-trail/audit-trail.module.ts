import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AUDIT_TRAIL } from '../shared/domain/ports/audit-trail.port';
import { SEAL_REGISTRY } from '../shared/domain/ports/seal-registry.port';
import { AnchorChainHandler } from './application/commands/anchor-chain/anchor-chain.handler';
import { CHAIN_ANCHOR_STORE } from './application/ports/chain-anchor.store';
import { TIMESTAMP_AUTHORITY } from './application/ports/timestamp-authority.port';
import { TIMESTAMP_VERIFIER } from './application/ports/timestamp-verifier.port';
import { CASE_AUDIT_EVENT_READER } from './application/queries/list-case-audit-events/case-audit-event.reader';
import { ListCaseAuditEventsHandler } from './application/queries/list-case-audit-events/list-case-audit-events.handler';
import { CHAIN_EVENT_READER } from './application/queries/verify-chain/chain-event.reader';
import { VerifyChainHandler } from './application/queries/verify-chain/verify-chain.handler';
import { AuditTrailController } from './infrastructure/http/audit-trail.controller';
import { InternalAuditController } from './infrastructure/http/internal-audit.controller';
import { AdminSealRegistry } from './infrastructure/persistence/admin-seal-registry';
import { PrismaAuditTrailAppender } from './infrastructure/persistence/prisma-audit-trail.appender';
import { PrismaSealSourceReader } from './infrastructure/persistence/prisma-seal-source.reader';
import { PrismaCaseAuditEventReader } from './infrastructure/persistence/prisma-case-audit-event.reader';
import { PrismaChainAnchorStore } from './infrastructure/persistence/prisma-chain-anchor.store';
import { PrismaChainEventReader } from './infrastructure/persistence/prisma-chain-event.reader';
import { Rfc3161TimestampVerifier } from './infrastructure/tsa/rfc3161-timestamp.verifier';
import { Rfc3161TsaAdapter } from './infrastructure/tsa/rfc3161-tsa.adapter';
import { TenantChainAnchoringRunner } from './infrastructure/verification/tenant-chain-anchoring.runner';
import { TenantChainVerificationRunner } from './infrastructure/verification/tenant-chain-verification.runner';
import { TenantSealProjectionRunner } from './infrastructure/verification/tenant-seal-projection.runner';

@Module({
  imports: [CqrsModule],
  controllers: [AuditTrailController, InternalAuditController],
  providers: [
    ListCaseAuditEventsHandler,
    VerifyChainHandler,
    AnchorChainHandler,
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
  exports: [AUDIT_TRAIL, SEAL_REGISTRY],
})
export class AuditTrailModule {}
