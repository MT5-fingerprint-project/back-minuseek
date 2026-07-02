import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './infrastructure/http/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/http/jwt-auth.guard';

/**
 * Enregistre la stratégie de validation des access tokens Keycloak
 * (JwtStrategy) et expose le JwtAuthGuard + les décorateurs `@Public` /
 * `@CurrentUser`.
 *
 * `JwtAuthGuard` est enregistré en `APP_GUARD` global dans `AppModule`.
 * Les routes publiques s'exemptent via `@Public()`.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
