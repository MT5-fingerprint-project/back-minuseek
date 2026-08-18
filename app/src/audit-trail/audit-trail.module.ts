import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AUDIT_TRAIL } from '../shared/domain/ports/audit-trail.port';
import { CHAIN_EVENT_READER } from './application/queries/verify-chain/chain-event.reader';
import { VerifyChainHandler } from './application/queries/verify-chain/verify-chain.handler';
import { InternalAuditController } from './infrastructure/http/internal-audit.controller';
import { PrismaAuditTrailAppender } from './infrastructure/persistence/prisma-audit-trail.appender';
import { PrismaChainEventReader } from './infrastructure/persistence/prisma-chain-event.reader';
import { TenantChainVerificationRunner } from './infrastructure/verification/tenant-chain-verification.runner';

@Module({
  imports: [CqrsModule],
  controllers: [InternalAuditController],
  providers: [
    VerifyChainHandler,
    TenantChainVerificationRunner,
    {
      provide: AUDIT_TRAIL,
      useClass: PrismaAuditTrailAppender,
    },
    {
      provide: CHAIN_EVENT_READER,
      useClass: PrismaChainEventReader,
    },
  ],
  exports: [AUDIT_TRAIL],
})
export class AuditTrailModule {}
