import { Module } from '@nestjs/common';
import { CASE_ACCESS_READER } from './application/case-access.reader';
import { CaseAccessService } from './application/case-access.service';
import { CaseAccessGuard } from './infrastructure/http/case-access.guard';
import { PrismaCaseAccessReader } from './infrastructure/persistence/prisma-case-access.reader';

@Module({
  providers: [
    CaseAccessService,
    CaseAccessGuard,
    {
      provide: CASE_ACCESS_READER,
      useClass: PrismaCaseAccessReader,
    },
  ],
  exports: [CaseAccessService, CaseAccessGuard],
})
export class AccessModule {}
