import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationModule } from './investigation/investigation.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    SharedModule,
    PrismaModule,
    AuthModule,
    InvestigationModule,
    BiometricsModule,
  ],
})
export class AppModule {}
