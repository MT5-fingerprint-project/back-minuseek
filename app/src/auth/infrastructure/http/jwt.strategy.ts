import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AuthenticatedUser } from './auth.types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

/**
 * Stratégie Passport qui valide les access tokens Keycloak : signature vérifiée
 * contre le JWKS du realm (clés récupérées et mises en cache via jwks-rsa),
 * plus contrôle de l'issuer, de l'audience et de l'expiration.
 *
 * `issuer` utilise l'URL publique (telle que vue dans le claim `iss` du token),
 * tandis que le JWKS est récupéré via l'URL interne — les deux diffèrent en
 * Docker (localhost vs nom de service keycloak).
 *
 * Phase 1 : un seul realm. Pour le multitenant (un realm par client), remplacer
 * `secretOrKeyProvider`/`issuer` par un provider qui choisit le JWKS selon le
 * claim `iss` du token (cf. docs/multitenancy.md).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const realm = requireEnv('KEYCLOAK_REALM');
    const publicUrl = requireEnv('KEYCLOAK_PUBLIC_URL');
    const internalUrl = requireEnv('KEYCLOAK_INTERNAL_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer: `${publicUrl}/realms/${realm}`,
      audience: requireEnv('KEYCLOAK_AUDIENCE'),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `${internalUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });
  }

  /** Le payload est déjà validé ; on le renvoie tel quel dans `request.user`. */
  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
