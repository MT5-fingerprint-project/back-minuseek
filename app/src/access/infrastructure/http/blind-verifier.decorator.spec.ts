import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import type { RequestWithCaseAccess } from './case-access.guard';
import {
  blindVerifierIdOf,
  caseVerifierIdOf,
} from './blind-verifier.decorator';

const AFFAIRE = '11111111-1111-4111-8111-111111111111';

const LUCIE: UserReadModel = {
  id: 'lucie',
  identityProviderId: 'sub-lucie',
  role: UserRoleEnum.OPERATOR,
  grade: 'Brigadier',
  serviceNumber: '12345',
  status: 'ACTIVE',
  firstName: 'Lucie',
  lastName: 'Bernard',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const requestFor = (
  overrides: Partial<RequestWithCaseAccess>,
): RequestWithCaseAccess =>
  ({ currentUser: LUCIE, ...overrides }) as RequestWithCaseAccess;

describe('blindVerifierIdOf', () => {
  it('rend le compte du vérificateur en mission sur cette affaire', () => {
    expect(
      blindVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'CASE_VERIFIER',
            verificationInProgress: true,
          },
        }),
      ),
    ).toBe('lucie');
  });

  it("ne rend rien pour l'opérateur de l'affaire", () => {
    expect(
      blindVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'CASE_OPERATOR',
            verificationInProgress: false,
          },
        }),
      ),
    ).toBeNull();
  });

  it('ne rend rien pour le responsable de service', () => {
    expect(
      blindVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'SERVICE_MANAGER',
            verificationInProgress: false,
          },
        }),
      ),
    ).toBeNull();
  });

  it("ne rend rien sur une route que le garde n'a pas résolue", () => {
    expect(blindVerifierIdOf(requestFor({}))).toBeNull();
  });

  it("ne rend rien au vérificateur dont la mission est rendue : il n'est plus en aveugle", () => {
    expect(
      blindVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'CASE_VERIFIER',
            verificationInProgress: false,
          },
        }),
      ),
    ).toBeNull();
  });
});

describe('caseVerifierIdOf', () => {
  it('rend le compte du vérificateur, mission ouverte', () => {
    expect(
      caseVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'CASE_VERIFIER',
            verificationInProgress: true,
          },
        }),
      ),
    ).toBe('lucie');
  });

  it('rend encore son compte une fois la mission rendue', () => {
    expect(
      caseVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'CASE_VERIFIER',
            verificationInProgress: false,
          },
        }),
      ),
    ).toBe('lucie');
  });

  it("ne rend rien pour l'opérateur de l'affaire", () => {
    expect(
      caseVerifierIdOf(
        requestFor({
          caseAccess: {
            caseId: AFFAIRE,
            title: 'CASE_OPERATOR',
            verificationInProgress: false,
          },
        }),
      ),
    ).toBeNull();
  });
});
