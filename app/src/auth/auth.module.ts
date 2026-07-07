import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { MultiRealmJwtStrategy } from './infrastructure/http/multi-realm-jwt.strategy';
import { JwtAuthGuard } from './infrastructure/http/jwt-auth.guard';

/**
 * Enregistre la stratégie de validation des access tokens Keycloak
 * (MultiRealmJwtStrategy, un realm par tenant) et expose JwtAuthGuard +
 * @CurrentUser.
 *
 * JwtAuthGuard est enregistré en APP_GUARD global dans AppModule —
 * toute route exige un token valide, sans opt-out.
 */
@Module({
  imports: [PassportModule],
  providers: [MultiRealmJwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
