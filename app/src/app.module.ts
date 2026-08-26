import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
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
import { CurrentUserGuard } from './identity-access/infrastructure/http/current-user.guard';
import { AuditTrailModule } from './audit-trail/audit-trail.module';
import { AccessModule } from './access/access.module';
import { CaseAccessGuard } from './access/infrastructure/http/case-access.guard';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [
    CqrsModule,
    SharedModule,
    TenancyModule,
    AuthModule,
    InvestigationModule,
    BiometricsModule,
    OrganizationModule,
    IdentityAccessModule,
    AuditTrailModule,
    ReportingModule,
    AccessModule,
  ],
  providers: [
    //keep this order, first we find use the token, if it's ok we go to the tenant guard
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    // en dernier : le tenant est prouvé, on peut lire le compte de l'appelant,
    // puis son accès à l'affaire visée par la route
    { provide: APP_GUARD, useClass: CurrentUserGuard },
    { provide: APP_GUARD, useClass: CaseAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
