import { Module } from '@nestjs/common';
import { KeycloakAuthGuard } from './infrastructure/http/keycloak-auth.guard';

@Module({
  providers: [KeycloakAuthGuard],
  exports: [KeycloakAuthGuard],
})
export class AuthModule {}
