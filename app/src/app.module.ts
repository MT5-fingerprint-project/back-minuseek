import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationModule } from './investigation/investigation.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, PrismaModule, InvestigationModule],
})
export class AppModule {}
