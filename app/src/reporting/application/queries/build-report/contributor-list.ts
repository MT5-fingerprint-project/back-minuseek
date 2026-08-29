import { AuditActorTypeEnum } from '../../../../shared/domain/audit/audit-actor.vo';
import { CaseContributorData } from '../../ports/case-contributors.reader';

export interface ContributorActor {
  type: string;
  sub: string;
  displayName: string;
}

export interface ContributorAccount {
  id: string;
  identityProviderId: string;
  grade: string;
  firstName: string;
  lastName: string;
}

interface SortableContributor {
  sortKey: string;
  contributor: CaseContributorData;
}

const SYSTEM_ACTOR: string = AuditActorTypeEnum.SYSTEM;

function printedName(account: ContributorAccount): string {
  return `${account.lastName.toLocaleUpperCase('fr')} ${account.firstName}`;
}

export function buildContributorList(
  actors: ContributorActor[],
  accounts: ContributorAccount[],
): CaseContributorData[] {
  const accountsByProviderId = new Map(
    accounts.map((account) => [account.identityProviderId, account]),
  );

  const bySub = new Map<string, SortableContributor>();
  for (const actor of actors) {
    if (actor.type === SYSTEM_ACTOR || bySub.has(actor.sub)) {
      continue;
    }
    const account = accountsByProviderId.get(actor.sub);
    bySub.set(
      actor.sub,
      account
        ? {
            sortKey: account.lastName,
            contributor: {
              userId: account.id,
              grade: account.grade,
              displayName: printedName(account),
            },
          }
        : {
            sortKey: actor.displayName,
            contributor: {
              userId: null,
              grade: null,
              displayName: actor.displayName,
            },
          },
    );
  }

  return [...bySub.values()]
    .sort(
      (left, right) =>
        left.sortKey.localeCompare(right.sortKey, 'fr') ||
        left.contributor.displayName.localeCompare(
          right.contributor.displayName,
          'fr',
        ),
    )
    .map((sortable) => sortable.contributor);
}
