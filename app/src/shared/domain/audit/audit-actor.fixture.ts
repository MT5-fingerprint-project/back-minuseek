import { AuditActor } from './audit-actor.vo';

export const EXPERT_ACTOR = AuditActor.user({
  sub: 'kc-sub-42',
  username: 'jdupont',
  displayName: 'Jean Dupont',
});
