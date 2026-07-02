import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './infrastructure/http/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/http/jwt-auth.guard';

/**
 * Enregistre la stratégie de validation des access tokens Keycloak
 * (JwtStrategy) et expose JwtAuthGuard + @CurrentUser.
 *
 * JwtAuthGuard est enregistré en APP_GUARD global dans AppModule —
 * toute route exige un token valide, sans opt-out.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
