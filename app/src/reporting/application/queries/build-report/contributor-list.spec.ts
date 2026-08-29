import { AuditActorTypeEnum } from '../../../../shared/domain/audit/audit-actor.vo';
import {
  buildContributorList,
  ContributorAccount,
  ContributorActor,
} from './contributor-list';

function actor(overrides: Partial<ContributorActor> = {}): ContributorActor {
  return {
    type: AuditActorTypeEnum.USER,
    sub: 'sub-aguilar',
    displayName: 'Sébastien Aguilar',
    ...overrides,
  };
}

function account(
  overrides: Partial<ContributorAccount> = {},
): ContributorAccount {
  return {
    id: 'user-aguilar',
    identityProviderId: 'sub-aguilar',
    grade: 'Technicien en Chef de Police Technique et Scientifique',
    firstName: 'Sébastien',
    lastName: 'Aguilar',
    ...overrides,
  };
}

describe('buildContributorList', () => {
  it('nomme un auteur avec son grade et son nom en capitales', () => {
    const contributors = buildContributorList([actor()], [account()]);

    expect(contributors).toEqual([
      {
        userId: 'user-aguilar',
        grade: 'Technicien en Chef de Police Technique et Scientifique',
        displayName: 'AGUILAR Sébastien',
      },
    ]);
  });

  it('ne nomme un auteur qu’une fois, quel que soit le nombre de ses actes', () => {
    const contributors = buildContributorList(
      [actor(), actor(), actor()],
      [account()],
    );

    expect(contributors).toHaveLength(1);
  });

  it('écarte les tâches automatiques : elles n’ont concouru à rien', () => {
    const contributors = buildContributorList(
      [
        actor({ type: AuditActorTypeEnum.SYSTEM, sub: 'system:anchoring' }),
        actor(),
      ],
      [account()],
    );

    expect(contributors.map((contributor) => contributor.userId)).toEqual([
      'user-aguilar',
    ]);
  });

  it('trie par nom de famille, pas par ordre des actes', () => {
    const contributors = buildContributorList(
      [
        actor({ sub: 'sub-guichard', displayName: 'Lucile Guichard' }),
        actor({ sub: 'sub-bordier', displayName: 'Aude Bordier' }),
        actor(),
      ],
      [
        account(),
        account({
          id: 'user-guichard',
          identityProviderId: 'sub-guichard',
          grade: 'Agent Spécialisé de Police Technique et Scientifique',
          firstName: 'Lucile',
          lastName: 'Guichard',
        }),
        account({
          id: 'user-bordier',
          identityProviderId: 'sub-bordier',
          grade: 'Major de Police',
          firstName: 'Aude',
          lastName: 'Bordier',
        }),
      ],
    );

    expect(contributors.map((contributor) => contributor.displayName)).toEqual([
      'AGUILAR Sébastien',
      'BORDIER Aude',
      'GUICHARD Lucile',
    ]);
  });

  it('départage deux homonymes par leur nom imprimé', () => {
    const contributors = buildContributorList(
      [actor({ sub: 'sub-2' }), actor({ sub: 'sub-1' })],
      [
        account({
          id: 'user-1',
          identityProviderId: 'sub-1',
          firstName: 'Anne',
        }),
        account({
          id: 'user-2',
          identityProviderId: 'sub-2',
          firstName: 'Zoé',
        }),
      ],
    );

    expect(contributors.map((contributor) => contributor.displayName)).toEqual([
      'AGUILAR Anne',
      'AGUILAR Zoé',
    ]);
  });

  it('garde le nom inscrit au registre quand l’auteur n’a pas de compte, sans lui inventer de grade', () => {
    const contributors = buildContributorList([actor()], []);

    expect(contributors).toEqual([
      {
        userId: null,
        grade: null,
        displayName: 'Sébastien Aguilar',
      },
    ]);
  });

  it('garde le nom sous lequel un auteur sans compte a agi la première fois', () => {
    const contributors = buildContributorList(
      [
        actor({ displayName: 'Sébastien Aguilar' }),
        actor({ displayName: 'S. Aguilar' }),
      ],
      [],
    );

    expect(contributors.map((one) => one.displayName)).toEqual([
      'Sébastien Aguilar',
    ]);
  });

  it('ne nomme personne sur un dossier sans acte', () => {
    expect(buildContributorList([], [account()])).toEqual([]);
  });
});
