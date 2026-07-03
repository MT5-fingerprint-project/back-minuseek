import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { InvestigationModule } from './investigation/investigation.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/infrastructure/http/jwt-auth.guard';
import { DataProxyModule } from './data-proxy/data-proxy.module';

@Module({
  imports: [
    SharedModule,
    PrismaModule,
    AuthModule,
    InvestigationModule,
    BiometricsModule,
    DataProxyModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
