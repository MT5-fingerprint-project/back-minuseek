import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuthenticatedUser } from './auth.types';

/** Snapshot figé à l'instant de l'acte : les rapports relisent ce champ, jamais Keycloak. */
export function toAuditActor(user: AuthenticatedUser | undefined): AuditActor {
  const username = user?.preferred_username ?? '';
  const name = typeof user?.name === 'string' ? user.name : '';
  return AuditActor.user({
    sub: user?.sub ?? '',
    username,
    displayName: name.trim() === '' ? username : name,
  });
}
