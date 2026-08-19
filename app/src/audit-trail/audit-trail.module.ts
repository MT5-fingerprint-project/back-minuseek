import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AUDIT_TRAIL } from '../shared/domain/ports/audit-trail.port';
import { ListCaseAuditEventsHandler } from './application/queries/list-case-audit-events/list-case-audit-events.handler';
import { CASE_AUDIT_EVENT_READER } from './application/queries/list-case-audit-events/case-audit-event.reader';
import { AuditTrailController } from './infrastructure/http/audit-trail.controller';
import { PrismaAuditTrailAppender } from './infrastructure/persistence/prisma-audit-trail.appender';
import { PrismaCaseAuditEventReader } from './infrastructure/persistence/prisma-case-audit-event.reader';

@Module({
  imports: [CqrsModule],
  controllers: [AuditTrailController],
  providers: [
    ListCaseAuditEventsHandler,
    {
      provide: AUDIT_TRAIL,
      useClass: PrismaAuditTrailAppender,
    },
    {
      provide: CASE_AUDIT_EVENT_READER,
      useClass: PrismaCaseAuditEventReader,
    },
  ],
  exports: [AUDIT_TRAIL],
})
export class AuditTrailModule {}
