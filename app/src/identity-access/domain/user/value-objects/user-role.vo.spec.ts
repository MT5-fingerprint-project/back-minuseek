import { UserRole, UserRoleEnum, InvalidUserRoleError } from './user-role.vo';

describe('UserRole', () => {
  it('crée un rôle OPERATOR valide', () => {
    const role = UserRole.from('OPERATOR');
    expect(role.getValue()).toBe(UserRoleEnum.OPERATOR);
  });

  it('lève une erreur pour un rôle inconnu', () => {
    expect(() => UserRole.from('SUPERADMIN')).toThrow(InvalidUserRoleError);
  });

  it('expose les fabriques ADMIN / OPERATOR / EXPERT', () => {
    expect(UserRole.admin().getValue()).toBe(UserRoleEnum.ADMIN);
    expect(UserRole.operator().getValue()).toBe(UserRoleEnum.OPERATOR);
    expect(UserRole.expert().getValue()).toBe(UserRoleEnum.EXPERT);
  });

  it('compare deux rôles par valeur', () => {
    expect(UserRole.expert().equals(UserRole.from('EXPERT'))).toBe(true);
    expect(UserRole.expert().equals(UserRole.admin())).toBe(false);
  });
});
