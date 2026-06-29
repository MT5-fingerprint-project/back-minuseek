import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './infrastructure/http/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/http/jwt-auth.guard';

/**
 * Enregistre la stratégie de validation des access tokens Keycloak
 * (JwtStrategy) et expose le JwtAuthGuard + les décorateurs `@Public` /
 * `@CurrentUser`.
 *
 * Périmètre : ce ticket installe Keycloak et la *capacité* de validation, mais
 * ne protège PAS encore les routes — sinon l'API serait inutilisable tant que
 * le front n'a pas de login. L'activation se fera avec le ticket « Login » :
 *   - globalement  → { provide: APP_GUARD, useClass: JwtAuthGuard }
 *   - ou ciblée    → @UseGuards(JwtAuthGuard) sur les routes concernées
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
