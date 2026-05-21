import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationModule } from './investigation/investigation.module';

@Module({
  imports: [PrismaModule, InvestigationModule],
})
export class AppModule { }
