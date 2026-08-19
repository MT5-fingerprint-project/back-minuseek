import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { InvestigationModule } from './investigation/investigation.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/infrastructure/http/jwt-auth.guard';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantGuard } from './tenancy/infrastructure/http/tenant.guard';
import { TenantInterceptor } from './tenancy/infrastructure/http/tenant.interceptor';
import { OrganizationModule } from './organization/organization.module';
import { IdentityAccessModule } from './identity-access/identity-access.module';
import { AuditTrailModule } from './audit-trail/audit-trail.module';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [
    SharedModule,
    TenancyModule,
    AuthModule,
    InvestigationModule,
    BiometricsModule,
    OrganizationModule,
    IdentityAccessModule,
    AuditTrailModule,
    ReportingModule,
  ],
  providers: [
    //keep this order, first we find use the token, if it's ok we go to the tenant guard
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
