import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationModule } from './investigation/investigation.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/infrastructure/http/jwt-auth.guard';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    SharedModule,
    PrismaModule,
    TenancyModule,
    AuthModule,
    InvestigationModule,
    BiometricsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
