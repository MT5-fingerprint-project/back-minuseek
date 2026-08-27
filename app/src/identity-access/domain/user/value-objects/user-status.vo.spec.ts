import {
  InvalidUserStatusError,
  UserStatus,
  UserStatusEnum,
} from './user-status.vo';

describe('UserStatus', () => {
  it('crée un état ACTIVE valide', () => {
    expect(UserStatus.from('ACTIVE').getValue()).toBe(UserStatusEnum.ACTIVE);
  });

  it('crée un état DISABLED valide', () => {
    expect(UserStatus.from('DISABLED').getValue()).toBe(
      UserStatusEnum.DISABLED,
    );
  });

  it('expose les fabriques ACTIVE / DISABLED', () => {
    expect(UserStatus.active().getValue()).toBe(UserStatusEnum.ACTIVE);
    expect(UserStatus.disabled().getValue()).toBe(UserStatusEnum.DISABLED);
  });

  it('lève une erreur pour un état inconnu', () => {
    expect(() => UserStatus.from('SUSPENDED')).toThrow(InvalidUserStatusError);
  });

  it("nomme la valeur reçue dans le message d'erreur", () => {
    expect(() => UserStatus.from('SUSPENDED')).toThrow(/SUSPENDED/);
  });

  it.each(['active', ' ACTIVE ', '', '__proto__', 'toString'])(
    'refuse « %s », ni la casse ni les espaces ne sont tolérés',
    (raw) => {
      expect(() => UserStatus.from(raw)).toThrow(InvalidUserStatusError);
    },
  );

  it('refuse une valeur nulle castée', () => {
    expect(() => UserStatus.from(null as unknown as string)).toThrow(
      InvalidUserStatusError,
    );
  });

  it.each(Object.values(UserStatusEnum))(
    'fait un aller-retour sur « %s »',
    (value) => {
      expect(UserStatus.from(value).getValue()).toBe(value);
    },
  );

  it('compare deux états par valeur', () => {
    expect(UserStatus.active().equals(UserStatus.from('ACTIVE'))).toBe(true);
    expect(UserStatus.active().equals(UserStatus.disabled())).toBe(false);
  });
});
