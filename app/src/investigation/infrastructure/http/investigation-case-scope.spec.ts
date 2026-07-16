import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { resolveInvestigationCaseScope } from './investigation-case-scope';

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  sub: 'user-sub-1',
  tenantSlug: 'tenant-demo',
  isSystemRealm: false,
  ...overrides,
});

describe('resolveInvestigationCaseScope', () => {
  it('restreint un utilisateur tenant à ses affaires assignées (stub OPERATOR)', () => {
    const scope = resolveInvestigationCaseScope(makeUser());
    expect(scope.operatorId).toBe('user-sub-1');
  });

  it('refuse le realm système (SUPERADMIN, IA-21)', () => {
    expect(() =>
      resolveInvestigationCaseScope(
        makeUser({ isSystemRealm: true, tenantSlug: undefined }),
      ),
    ).toThrow(ForbiddenException);
  });
});
