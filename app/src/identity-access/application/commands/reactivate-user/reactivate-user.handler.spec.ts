import { User } from '../../../domain/user/entity/user';
import { PersonalData } from '../../../domain/user/value-objects/personal-data.vo';
import {
  UserRole,
  UserRoleEnum,
} from '../../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';
import { ServiceAccountNotFoundError } from '../../../domain/user/errors/service-account-not-found.error';
import {
  SelfStatusChangeNotAllowedError,
  UserAdministrationNotAllowedError,
} from '../../../domain/user/errors/user-administration-not-allowed.error';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user.repository';
import { InMemoryServiceAccountIdentity } from '../../../infrastructure/keycloak/in-memory-service-account-identity.adapter';
import { DeactivateUserCommand } from '../deactivate-user/deactivate-user.command';
import { DeactivateUserHandler } from '../deactivate-user/deactivate-user.handler';
import { ReactivateUserCommand } from './reactivate-user.command';
import { ReactivateUserHandler } from './reactivate-user.handler';

const CHEF = { id: 'user-chef', role: UserRoleEnum.ADMIN };

function anUser(id: string, identityProviderId: string, role: UserRole): User {
  return User.register({
    id,
    identityProviderId,
    role,
    grade: 'Technicien',
    serviceNumber: `PTS-${id}`,
    personalData: PersonalData.of({ firstName: 'Marie', lastName: 'Curie' }),
  });
}

/** Marque l'ordre des écritures : le fournisseur d'identité doit précéder la
 * base, sinon un échec du premier laisserait notre colonne déjà changée. */
class TracingUserRepository extends InMemoryUserRepository {
  constructor(private readonly trace: string[]) {
    super();
  }

  override save(user: User): Promise<void> {
    this.trace.push('db');
    return super.save(user);
  }
}

function build() {
  const trace: string[] = [];
  const repo = new TracingUserRepository(trace);
  const identity = new InMemoryServiceAccountIdentity(trace);
  return {
    repo,
    identity,
    trace,
    handler: new ReactivateUserHandler(repo, identity),
    deactivate: new DeactivateUserHandler(repo, identity),
  };
}

async function seedDisabled(repo: InMemoryUserRepository): Promise<void> {
  await repo.save(anUser('user-chef', 'kc-sub-chef', UserRole.admin()));
  const marie = anUser('user-marie', 'kc-sub-marie', UserRole.operator());
  marie.disable();
  await repo.save(marie);
}

async function statusOf(
  repo: InMemoryUserRepository,
  id: string,
): Promise<string | undefined> {
  return (await repo.findById(id))?.status.getValue();
}

describe('ReactivateUserHandler', () => {
  it('réactive un compte désactivé', async () => {
    const { handler, repo, identity } = build();
    await seedDisabled(repo);

    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.ACTIVE);
    expect(identity.calls).toEqual([
      { identityProviderId: 'kc-sub-marie', enabled: true },
    ]);
  });

  it("appelle le fournisseur d'identité avant d'écrire en base", async () => {
    const { handler, repo, trace } = build();
    await seedDisabled(repo);
    trace.length = 0;

    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    expect(trace).toEqual(['idp', 'db']);
  });

  it('rend au responsable un compte qu’il vient de désactiver par erreur', async () => {
    const { handler, deactivate, repo } = build();
    await repo.save(anUser('user-chef', 'kc-sub-chef', UserRole.admin()));
    await repo.save(anUser('user-marie', 'kc-sub-marie', UserRole.operator()));

    await deactivate.execute(new DeactivateUserCommand(CHEF, 'user-marie'));
    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.ACTIVE);
  });

  // Un jeton émis avant la coupure reste valide jusqu'à son expiration : sans
  // cette garde, un responsable désactivé annule sa propre désactivation.
  it('refuse au responsable de se réactiver lui-même, sans rien changer', async () => {
    const { handler, repo, identity } = build();
    await seedDisabled(repo);
    const chef = (await repo.findById('user-chef'))!;
    chef.disable();
    await repo.save(chef);

    await expect(
      handler.execute(new ReactivateUserCommand(CHEF, 'user-chef')),
    ).rejects.toThrow(SelfStatusChangeNotAllowedError);
    expect(identity.calls).toEqual([]);
    expect(await statusOf(repo, 'user-chef')).toBe(UserStatusEnum.DISABLED);
  });

  it('ne touche pas au profil', async () => {
    const { handler, repo } = build();
    await seedDisabled(repo);
    const before = (await repo.findById('user-marie'))!.toPrimitives();

    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    const after = (await repo.findById('user-marie'))!.toPrimitives();
    expect(after).toEqual({
      ...before,
      status: UserStatusEnum.ACTIVE,
      updatedAt: after.updatedAt,
    });
  });

  it("refuse un identifiant introuvable, sans appeler le fournisseur d'identité", async () => {
    const { handler, repo, identity } = build();
    await seedDisabled(repo);

    await expect(
      handler.execute(new ReactivateUserCommand(CHEF, 'user-fantome')),
    ).rejects.toThrow(ServiceAccountNotFoundError);
    expect(identity.calls).toEqual([]);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    'refuse un appelant %s, sans rien changer',
    async (role) => {
      const { handler, repo, identity } = build();
      await seedDisabled(repo);

      await expect(
        handler.execute(
          new ReactivateUserCommand({ id: 'user-x', role }, 'user-marie'),
        ),
      ).rejects.toThrow(UserAdministrationNotAllowedError);
      expect(identity.calls).toEqual([]);
      expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.DISABLED);
    },
  );

  // Chemin de réparation d'une divergence née de la console Keycloak : notre
  // colonne dit « actif » d'un compte que quelqu'un y a désactivé à la main.
  it('réactive sans erreur un compte déjà actif chez nous', async () => {
    const { handler, repo, identity } = build();
    await seedDisabled(repo);
    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.ACTIVE);
    expect(identity.calls).toHaveLength(2);
  });

  it("laisse la colonne intacte quand le fournisseur d'identité refuse", async () => {
    const { handler, repo, identity } = build();
    await seedDisabled(repo);
    const panne = new Error('keycloak down');
    identity.failure = panne;

    await expect(
      handler.execute(new ReactivateUserCommand(CHEF, 'user-marie')),
    ).rejects.toBe(panne);
    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.DISABLED);
  });

  it("rattrape la colonne au rejeu quand l'écriture avait échoué", async () => {
    const { handler, repo, identity } = build();
    await seedDisabled(repo);
    repo.saveFailure = new Error('base indisponible');

    await expect(
      handler.execute(new ReactivateUserCommand(CHEF, 'user-marie')),
    ).rejects.toThrow('base indisponible');
    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.DISABLED);

    repo.saveFailure = undefined;
    await handler.execute(new ReactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.ACTIVE);
    expect(identity.calls).toHaveLength(2);
  });
});
