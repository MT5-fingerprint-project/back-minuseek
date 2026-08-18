import { InvalidAuditActorError } from '../../../shared/domain/audit/audit-actor.vo';
import { AuthenticatedUser } from './auth.types';
import { toAuditActor } from './audit-actor.mapper';

const KEYCLOAK_USER: AuthenticatedUser = {
  sub: 'kc-sub-42',
  preferred_username: 'jdupont',
  name: 'Jean Dupont',
};

describe('toAuditActor', () => {
  it("fige le snapshot d'identité porté par le token", () => {
    expect(toAuditActor(KEYCLOAK_USER).toPrimitives()).toEqual({
      type: 'USER',
      sub: 'kc-sub-42',
      username: 'jdupont',
      displayName: 'Jean Dupont',
    });
  });

  it("retombe sur le username quand le token n'a pas de nom d'affichage", () => {
    const withoutName: AuthenticatedUser = {
      sub: 'kc-sub-42',
      preferred_username: 'jdupont',
    };

    expect(toAuditActor(withoutName).toPrimitives().displayName).toBe(
      'jdupont',
    );
  });

  it("ignore un claim name qui n'est pas une chaîne", () => {
    const numericName: AuthenticatedUser = { ...KEYCLOAK_USER, name: 42 };

    expect(toAuditActor(numericName).toPrimitives().displayName).toBe(
      'jdupont',
    );
  });

  it('refuse un token sans preferred_username', () => {
    const withoutUsername: AuthenticatedUser = { sub: 'kc-sub-42' };

    expect(() => toAuditActor(withoutUsername)).toThrow(InvalidAuditActorError);
  });

  it('refuse une requête sans utilisateur authentifié', () => {
    expect(() => toAuditActor(undefined)).toThrow(InvalidAuditActorError);
  });
});
