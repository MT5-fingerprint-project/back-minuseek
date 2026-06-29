import { JWTPayload } from 'jose';

export interface AuthenticatedUser extends JWTPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
