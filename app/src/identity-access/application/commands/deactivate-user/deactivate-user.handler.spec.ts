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
import { DeactivateUserCommand } from './deactivate-user.command';
import { DeactivateUserHandler } from './deactivate-user.handler';

const CHEF = { id: 'user-chef', role: UserRoleEnum.ADMIN };
const OPERATRICE = { id: 'user-marie', role: UserRoleEnum.OPERATOR };

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
    handler: new DeactivateUserHandler(repo, identity),
  };
}

async function seed(repo: InMemoryUserRepository): Promise<void> {
  await repo.save(anUser('user-chef', 'kc-sub-chef', UserRole.admin()));
  await repo.save(anUser('user-marie', 'kc-sub-marie', UserRole.operator()));
}

async function statusOf(
  repo: InMemoryUserRepository,
  id: string,
): Promise<string | undefined> {
  return (await repo.findById(id))?.status.getValue();
}

describe('DeactivateUserHandler', () => {
  it('désactive un compte du service à la demande du responsable', async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.DISABLED);
    expect(identity.calls).toEqual([
      { identityProviderId: 'kc-sub-marie', enabled: false },
    ]);
  });

  it("appelle le fournisseur d'identité avant d'écrire en base", async () => {
    const { handler, repo, trace } = build();
    await seed(repo);
    trace.length = 0;

    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));

    expect(trace).toEqual(['idp', 'db']);
  });

  it('laisse les autres comptes du service intacts', async () => {
    const { handler, repo } = build();
    await seed(repo);

    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-chef')).toBe(UserStatusEnum.ACTIVE);
    expect(repo.store.size).toBe(2);
  });

  it('ne touche ni au rôle, ni au grade, ni au matricule', async () => {
    const { handler, repo } = build();
    await seed(repo);
    const before = (await repo.findById('user-marie'))!.toPrimitives();

    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));

    const after = (await repo.findById('user-marie'))!.toPrimitives();
    expect(after).toEqual({
      ...before,
      status: UserStatusEnum.DISABLED,
      updatedAt: after.updatedAt,
    });
  });

  it("refuse un identifiant introuvable, sans appeler le fournisseur d'identité", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await expect(
      handler.execute(new DeactivateUserCommand(CHEF, 'user-fantome')),
    ).rejects.toThrow(ServiceAccountNotFoundError);
    expect(identity.calls).toEqual([]);
  });

  // L'isolation entre services est physique — une base par tenant — donc un
  // identifiant venu d'ailleurs n'existe pas dans la base courante.
  it("refuse un compte d'un autre service, qui est introuvable ici", async () => {
    const { handler, repo } = build();
    await seed(repo);

    await expect(
      handler.execute(
        new DeactivateUserCommand(CHEF, 'user-dun-autre-service'),
      ),
    ).rejects.toThrow(ServiceAccountNotFoundError);
  });

  it('refuse au responsable de se désactiver lui-même, sans rien changer', async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await expect(
      handler.execute(new DeactivateUserCommand(CHEF, 'user-chef')),
    ).rejects.toThrow(SelfStatusChangeNotAllowedError);
    expect(identity.calls).toEqual([]);
    expect(await statusOf(repo, 'user-chef')).toBe(UserStatusEnum.ACTIVE);
    expect(repo.store.size).toBe(2);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    'refuse un appelant %s, sans rien changer',
    async (role) => {
      const { handler, repo, identity } = build();
      await seed(repo);

      await expect(
        handler.execute(
          new DeactivateUserCommand({ id: 'user-marie', role }, 'user-chef'),
        ),
      ).rejects.toThrow(UserAdministrationNotAllowedError);
      expect(identity.calls).toEqual([]);
      expect(await statusOf(repo, 'user-chef')).toBe(UserStatusEnum.ACTIVE);
    },
  );

  it('oppose à un opérateur qui se cible lui-même le refus de rôle, pas celui d’auto-désactivation', async () => {
    const { handler, repo } = build();
    await seed(repo);

    await expect(
      handler.execute(new DeactivateUserCommand(OPERATRICE, 'user-marie')),
    ).rejects.toThrow(UserAdministrationNotAllowedError);
  });

  it("rappelle le fournisseur d'identité à chaque désactivation, même déjà désactivé", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));
    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));

    expect(identity.calls).toHaveLength(2);
    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.DISABLED);
  });

  it("laisse la colonne intacte quand le fournisseur d'identité refuse", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);
    const panne = new Error('keycloak down');
    identity.failure = panne;

    await expect(
      handler.execute(new DeactivateUserCommand(CHEF, 'user-marie')),
    ).rejects.toBe(panne);
    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.ACTIVE);
  });

  it("rattrape la colonne au rejeu quand l'écriture avait échoué", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);
    repo.saveFailure = new Error('base indisponible');

    await expect(
      handler.execute(new DeactivateUserCommand(CHEF, 'user-marie')),
    ).rejects.toThrow('base indisponible');
    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.ACTIVE);
    expect(identity.calls).toHaveLength(1);

    repo.saveFailure = undefined;
    await handler.execute(new DeactivateUserCommand(CHEF, 'user-marie'));

    expect(await statusOf(repo, 'user-marie')).toBe(UserStatusEnum.DISABLED);
    expect(identity.calls).toHaveLength(2);
  });
});
