import { Module } from '@nestjs/common';
import { AUDIT_TRAIL } from '../shared/domain/ports/audit-trail.port';
import { PrismaAuditTrailAppender } from './infrastructure/persistence/prisma-audit-trail.appender';

@Module({
  providers: [
    {
      provide: AUDIT_TRAIL,
      useClass: PrismaAuditTrailAppender,
    },
  ],
  exports: [AUDIT_TRAIL],
})
export class AuditTrailModule {}
