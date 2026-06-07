import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationModule } from './investigation/investigation.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, PrismaModule, InvestigationModule, BiometricsModule],
})
export class AppModule {}
