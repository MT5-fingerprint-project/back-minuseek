import { User } from './user';
import { UserRole, UserRoleEnum } from '../value-objects/user-role.vo';
import { PersonalData } from '../value-objects/personal-data.vo';

const personalData = PersonalData.of({ firstName: 'Marie', lastName: 'Curie' });

describe('User', () => {
  it('enregistre un opérateur et expose ses propriétés', () => {
    const user = User.register({
      id: 'uuid-test',
      identityProviderId: 'kc-sub-123',
      role: UserRole.operator(),
      grade: 'Technicien',
      serviceNumber: 'PTS-0007',
      personalData,
    });

    expect(user.id).toBe('uuid-test');
    expect(user.identityProviderId).toBe('kc-sub-123');
    expect(user.role.getValue()).toBe(UserRoleEnum.OPERATOR);
    expect(user.grade).toBe('Technicien');
    expect(user.serviceNumber).toBe('PTS-0007');
    expect(user.personalData.firstName).toBe('Marie');
  });

  it('initialise createdAt et updatedAt', () => {
    const user = User.register({
      id: 'uuid-test',
      identityProviderId: 'kc-sub-123',
      role: UserRole.admin(),
      grade: 'Ingénieur',
      serviceNumber: 'PTS-0001',
      personalData,
    });
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
    ).toThrow('User serviceNumber is required');
  });

  it('reconstitue un User depuis ses primitives (round-trip)', () => {
    const original = User.register({
      id: 'uuid-test',
      identityProviderId: 'kc-sub-123',
      role: UserRole.expert(),
      grade: 'Ingénieur',
      serviceNumber: 'PTS-0042',
      personalData,
    });

    const rebuilt = User.reconstitute(original.toPrimitives());

    expect(rebuilt.toPrimitives()).toEqual(original.toPrimitives());
  });
});
