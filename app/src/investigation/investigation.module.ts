import { Module } from '@nestjs/common';
import { InvestigationController } from './infrastructure/http/investigation.controller';
import { OpenInvestigationCaseHandler } from './application/commands/open-investigation-case/open-investigation-case.handler';
import { PrismaInvestigationCaseRepository } from './infrastructure/persistence/prisma-investigation-case.repository';
import { INVESTIGATION_CASE_REPOSITORY } from './domain/ports/investigation-case.repository';

@Module({
  controllers: [InvestigationController],
  providers: [
    OpenInvestigationCaseHandler,
    {
      provide: INVESTIGATION_CASE_REPOSITORY,
      useClass: PrismaInvestigationCaseRepository,
    },
  ],
})
export class InvestigationModule {}
