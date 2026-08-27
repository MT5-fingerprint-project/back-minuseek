import { User } from './user';
import { UserRole, UserRoleEnum } from '../value-objects/user-role.vo';
import { UserStatusEnum } from '../value-objects/user-status.vo';
import { InvalidUserStatusError } from '../value-objects/user-status.vo';
import { PersonalData } from '../value-objects/personal-data.vo';
import { InvalidUserProfileError } from '../errors/invalid-user-profile.error';

const personalData = PersonalData.of({ firstName: 'Marie', lastName: 'Curie' });

function anUser(): User {
  return User.register({
    id: 'uuid-test',
    identityProviderId: 'kc-sub-123',
    role: UserRole.operator(),
    grade: 'Technicien',
    serviceNumber: 'PTS-0007',
    personalData,
  });
}

afterEach(() => {
  jest.useRealTimers();
});

describe('User', () => {
  it('enregistre un opérateur et expose ses propriétés', () => {
    const user = anUser();

    expect(user.id).toBe('uuid-test');
    expect(user.identityProviderId).toBe('kc-sub-123');
    expect(user.role.getValue()).toBe(UserRoleEnum.OPERATOR);
    expect(user.grade).toBe('Technicien');
    expect(user.serviceNumber).toBe('PTS-0007');
    expect(user.personalData.firstName).toBe('Marie');
  });

  it('enregistre un compte actif par défaut', () => {
    expect(anUser().status.getValue()).toBe(UserStatusEnum.ACTIVE);
  });

  it('rend son état dans ses primitives', () => {
    expect(anUser().toPrimitives().status).toBe(UserStatusEnum.ACTIVE);
  });

  it('initialise createdAt et updatedAt', () => {
    const user = anUser();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('lève une erreur si le serviceNumber est vide', () => {
    expect(() =>
      User.register({
        id: 'uuid-test',
        identityProviderId: 'kc-sub-123',
        role: UserRole.expert(),
        grade: 'Ingénieur',
        serviceNumber: '   ',
        personalData,
      }),
    ).toThrow(InvalidUserProfileError);
  });

  it('reconstitue un User depuis ses primitives (round-trip)', () => {
    const original = anUser();

    const rebuilt = User.reconstitute(original.toPrimitives());

    expect(rebuilt.toPrimitives()).toEqual(original.toPrimitives());
  });

  it.each([UserStatusEnum.ACTIVE, UserStatusEnum.DISABLED])(
    'reconstitue un compte « %s » avec son état',
    (status) => {
      const rebuilt = User.reconstitute({
        ...anUser().toPrimitives(),
        status,
      });

      expect(rebuilt.status.getValue()).toBe(status);
    },
  );

  it('refuse de reconstituer un compte dont l’état est hors catalogue', () => {
    expect(() =>
      User.reconstitute({ ...anUser().toPrimitives(), status: 'SUSPENDED' }),
    ).toThrow(InvalidUserStatusError);
  });

  describe('désactivation', () => {
    it('désactive un compte actif', () => {
      const user = anUser();

      user.disable();

      expect(user.status.getValue()).toBe(UserStatusEnum.DISABLED);
    });

    it('réactive un compte désactivé', () => {
      const user = anUser();
      user.disable();

      user.reactivate();

      expect(user.status.getValue()).toBe(UserStatusEnum.ACTIVE);
    });

    it('reste idempotent quand on désactive deux fois', () => {
      const user = anUser();

      user.disable();
      user.disable();

      expect(user.status.getValue()).toBe(UserStatusEnum.DISABLED);
    });

    it('reste idempotent quand on réactive un compte déjà actif', () => {
      const user = anUser();

      user.reactivate();

      expect(user.status.getValue()).toBe(UserStatusEnum.ACTIVE);
    });

    it('ne touche pas au profil en désactivant', () => {
      const user = anUser();
      const before = user.toPrimitives();

      user.disable();

      expect(user.toPrimitives()).toEqual({
        ...before,
        status: UserStatusEnum.DISABLED,
        updatedAt: user.updatedAt,
      });
    });

    it('avance updatedAt à chaque désactivation', () => {
      const user = anUser();
      const before = user.updatedAt;
      jest.useFakeTimers().setSystemTime(before.getTime() + 1_000);

      user.disable();

      expect(user.updatedAt.getTime()).toBe(before.getTime() + 1_000);
    });

    it('laisse un compte réactivé repartir de l’état actif, pas d’un défaut recalculé', () => {
      const user = User.reconstitute({
        ...anUser().toPrimitives(),
        status: UserStatusEnum.DISABLED,
      });

      user.reactivate();

      expect(User.reconstitute(user.toPrimitives()).status.getValue()).toBe(
        UserStatusEnum.ACTIVE,
      );
    });
  });

  describe('correction de profil', () => {
    it('corrige les quatre champs d’un coup', () => {
      const user = anUser();

      user.correctProfile({
        firstName: 'Nadia',
        lastName: 'Belkacem',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0099',
      });

      expect(user.personalData.firstName).toBe('Nadia');
      expect(user.personalData.lastName).toBe('Belkacem');
      expect(user.grade).toBe('Brigadier-chef');
      expect(user.serviceNumber).toBe('PTS-0099');
    });

    it('trim les quatre champs corrigés', () => {
      const user = anUser();

      user.correctProfile({
        firstName: '  Nadia ',
        lastName: ' Belkacem  ',
        grade: '  Brigadier-chef ',
        serviceNumber: ' PTS-0099 ',
      });

      expect(user.personalData.firstName).toBe('Nadia');
      expect(user.personalData.lastName).toBe('Belkacem');
      expect(user.grade).toBe('Brigadier-chef');
      expect(user.serviceNumber).toBe('PTS-0099');
    });

    it('accepte un champ d’un seul caractère', () => {
      const user = anUser();

      user.correctProfile({
        firstName: 'A',
        lastName: 'B',
        grade: 'C',
        serviceNumber: 'D',
      });

      expect(user.grade).toBe('C');
    });

    it('rend un nom accentué et composé tel quel', () => {
      const user = anUser();

      user.correctProfile({
        firstName: 'Jean-François',
        lastName: 'Nguyễn Đức',
        grade: 'Brigadier',
        serviceNumber: 'PTS-0099',
      });

      expect(user.personalData.lastName).toBe('Nguyễn Đức');
    });

    it.each([
      ['firstName', { firstName: '' }],
      ['firstName en espaces', { firstName: '   ' }],
      ['lastName', { lastName: '' }],
      ['lastName en espaces', { lastName: '  ' }],
      ['grade', { grade: '' }],
      ['grade en espaces', { grade: '\t ' }],
      ['serviceNumber', { serviceNumber: '' }],
      ['serviceNumber en tabulations', { serviceNumber: '\t\t' }],
    ])('refuse de vider %s', (_label, override) => {
      const user = anUser();
      const before = user.toPrimitives();

      expect(() =>
        user.correctProfile({
          firstName: 'Nadia',
          lastName: 'Belkacem',
          grade: 'Brigadier-chef',
          serviceNumber: 'PTS-0099',
          ...override,
        }),
      ).toThrow(InvalidUserProfileError);
      expect(user.toPrimitives()).toEqual(before);
    });

    it.each(['firstName', 'lastName', 'grade', 'serviceNumber'])(
      'refuse un %s absent',
      (field) => {
        const user = anUser();

        expect(() =>
          user.correctProfile({
            firstName: 'Nadia',
            lastName: 'Belkacem',
            grade: 'Brigadier-chef',
            serviceNumber: 'PTS-0099',
            [field]: undefined as unknown as string,
          }),
        ).toThrow(InvalidUserProfileError);
      },
    );

    it('nomme le champ fautif', () => {
      const user = anUser();

      expect(() =>
        user.correctProfile({
          firstName: 'Nadia',
          lastName: 'Belkacem',
          grade: '  ',
          serviceNumber: 'PTS-0099',
        }),
      ).toThrow(/grade/);
    });

    it('ne change ni le rôle, ni l’identifiant du fournisseur, ni l’état, ni createdAt', () => {
      const user = anUser();
      const before = user.toPrimitives();

      user.correctProfile({
        firstName: 'Nadia',
        lastName: 'Belkacem',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0099',
      });

      const after = user.toPrimitives();
      expect(after.role).toBe(before.role);
      expect(after.identityProviderId).toBe(before.identityProviderId);
      expect(after.status).toBe(before.status);
      expect(after.createdAt).toEqual(before.createdAt);
    });

    it('avance updatedAt à chaque correction', () => {
      const user = anUser();
      const before = user.updatedAt;
      jest.useFakeTimers().setSystemTime(before.getTime() + 1_000);

      user.correctProfile({
        firstName: 'Nadia',
        lastName: 'Belkacem',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0099',
      });

      expect(user.updatedAt.getTime()).toBe(before.getTime() + 1_000);
    });

    it('laisse corriger le profil d’un compte désactivé', () => {
      const user = anUser();
      user.disable();

      user.correctProfile({
        firstName: 'Nadia',
        lastName: 'Belkacem',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0099',
      });

      expect(user.grade).toBe('Brigadier-chef');
      expect(user.status.getValue()).toBe(UserStatusEnum.DISABLED);
    });

    it('reste idempotent sur deux corrections identiques', () => {
      const user = anUser();
      const correction = {
        firstName: 'Nadia',
        lastName: 'Belkacem',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0099',
      };

      user.correctProfile(correction);
      const once = user.toPrimitives();
      user.correctProfile(correction);

      expect(user.toPrimitives()).toEqual({
        ...once,
        updatedAt: user.updatedAt,
      });
    });

    it('fait un aller-retour sur un compte corrigé et désactivé', () => {
      const user = anUser();
      user.disable();
      user.correctProfile({
        firstName: 'Nadia',
        lastName: 'Belkacem',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0099',
      });

      expect(User.reconstitute(user.toPrimitives()).toPrimitives()).toEqual(
        user.toPrimitives(),
      );
    });
  });
});
