import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AUDIT_TRAIL } from '../shared/domain/ports/audit-trail.port';
import { CASE_AUDIT_EVENT_READER } from './application/queries/list-case-audit-events/case-audit-event.reader';
import { ListCaseAuditEventsHandler } from './application/queries/list-case-audit-events/list-case-audit-events.handler';
import { CHAIN_EVENT_READER } from './application/queries/verify-chain/chain-event.reader';
import { VerifyChainHandler } from './application/queries/verify-chain/verify-chain.handler';
import { AuditTrailController } from './infrastructure/http/audit-trail.controller';
import { InternalAuditController } from './infrastructure/http/internal-audit.controller';
import { PrismaAuditTrailAppender } from './infrastructure/persistence/prisma-audit-trail.appender';
import { PrismaCaseAuditEventReader } from './infrastructure/persistence/prisma-case-audit-event.reader';
import { PrismaChainEventReader } from './infrastructure/persistence/prisma-chain-event.reader';
import { TenantChainVerificationRunner } from './infrastructure/verification/tenant-chain-verification.runner';

@Module({
  imports: [CqrsModule],
  controllers: [AuditTrailController, InternalAuditController],
  providers: [
    ListCaseAuditEventsHandler,
    VerifyChainHandler,
    TenantChainVerificationRunner,
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
  ],
  exports: [AUDIT_TRAIL],
})
export class AuditTrailModule {}
