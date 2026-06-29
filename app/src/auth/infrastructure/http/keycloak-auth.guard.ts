import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthenticatedUser } from './auth.types';

interface RealmConfig {
  issuer: string;
  jwks: JWTVerifyGetKey;
}

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  private readonly logger = new Logger(KeycloakAuthGuard.name);
  private readonly audience: string;
  private readonly realmsByIssuer = new Map<string, RealmConfig>();

  constructor(private readonly reflector: Reflector) {
    this.audience = this.requireEnv('KEYCLOAK_AUDIENCE');
    this.registerRealm(
      this.requireEnv('KEYCLOAK_REALM'),
      this.requireEnv('KEYCLOAK_PUBLIC_URL'),
      this.requireEnv('KEYCLOAK_INTERNAL_URL'),
    );
  }

  private registerRealm(realm: string, publicUrl: string, internalUrl: string) {
    const issuer = `${publicUrl}/realms/${realm}`;
    const jwksUrl = new URL(
      `${internalUrl}/realms/${realm}/protocol/openid-connect/certs`,
    );
    this.realmsByIssuer.set(issuer, {
      issuer,
      jwks: createRemoteJWKSet(jwksUrl),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Token Bearer manquant');

    let issuer: string | undefined;
    try {
      issuer = decodeJwt(token).iss;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }

    const realm = issuer ? this.realmsByIssuer.get(issuer) : undefined;
    if (!realm) throw new UnauthorizedException('Issuer non autorisé');

    try {
      const { payload } = await jwtVerify(token, realm.jwks, {
        issuer: realm.issuer,
        audience: this.audience,
      });
      request.user = payload as AuthenticatedUser;
      return true;
    } catch (e) {
      this.logger.debug(
        `Validation du token échouée: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Variable d'environnement manquante: ${name}`);
    }
    return value;
  }
}
