import { User } from '../../../domain/user/entity/user';
import { PersonalData } from '../../../domain/user/value-objects/personal-data.vo';
import {
  UserRole,
  UserRoleEnum,
} from '../../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';
import { InvalidUserProfileError } from '../../../domain/user/errors/invalid-user-profile.error';
import { ServiceAccountNotFoundError } from '../../../domain/user/errors/service-account-not-found.error';
import { ServiceNumberAlreadyExistsError } from '../../../domain/user/errors/user-already-registered.error';
import { UserAdministrationNotAllowedError } from '../../../domain/user/errors/user-administration-not-allowed.error';
import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user.repository';
import { InMemoryServiceAccountIdentity } from '../../../infrastructure/keycloak/in-memory-service-account-identity.adapter';
import { CorrectUserProfileCommand } from './correct-user-profile.command';
import { CorrectUserProfileHandler } from './correct-user-profile.handler';

const CHEF = { id: 'user-chef', role: UserRoleEnum.ADMIN };

const CORRECTION = {
  firstName: 'Nadia',
  lastName: 'Belkacem',
  grade: 'Brigadier-chef',
  serviceNumber: 'PTS-0099',
};

function anUser(
  id: string,
  identityProviderId: string,
  role: UserRole,
  serviceNumber: string,
): User {
  return User.register({
    id,
    identityProviderId,
    role,
    grade: 'Technicien',
    serviceNumber,
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
    handler: new CorrectUserProfileHandler(repo, identity),
  };
}

async function seed(repo: InMemoryUserRepository): Promise<void> {
  await repo.save(
    anUser('user-chef', 'kc-sub-chef', UserRole.admin(), 'PTS-0001'),
  );
  await repo.save(
    anUser('user-marie', 'kc-sub-marie', UserRole.operator(), 'PTS-0007'),
  );
}

const commandFor = (
  targetUserId: string,
  overrides: Partial<typeof CORRECTION> = {},
  requester = CHEF,
) =>
  new CorrectUserProfileCommand(requester, targetUserId, {
    ...CORRECTION,
    ...overrides,
  });

describe('CorrectUserProfileHandler', () => {
  it('corrige les quatre champs du profil', async () => {
    const { handler, repo } = build();
    await seed(repo);

    await handler.execute(commandFor('user-marie'));

    const corrected = (await repo.findById('user-marie'))!.toPrimitives();
    expect(corrected).toMatchObject({
      firstName: 'Nadia',
      lastName: 'Belkacem',
      grade: 'Brigadier-chef',
      serviceNumber: 'PTS-0099',
    });
  });

  it("transmet le seul nom au fournisseur d'identité, ni grade ni matricule", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await handler.execute(commandFor('user-marie'));

    expect(identity.renames).toEqual([
      {
        identityProviderId: 'kc-sub-marie',
        firstName: 'Nadia',
        lastName: 'Belkacem',
      },
    ]);
  });

  it("appelle le fournisseur d'identité avant d'écrire en base", async () => {
    const { handler, repo, trace } = build();
    await seed(repo);
    trace.length = 0;

    await handler.execute(commandFor('user-marie'));

    expect(trace).toEqual(['idp', 'db']);
  });

  it("ne change ni le rôle, ni l'état, ni l'identifiant du fournisseur", async () => {
    const { handler, repo } = build();
    await seed(repo);
    const before = (await repo.findById('user-marie'))!.toPrimitives();

    await handler.execute(commandFor('user-marie'));

    const after = (await repo.findById('user-marie'))!.toPrimitives();
    expect(after.role).toBe(before.role);
    expect(after.status).toBe(before.status);
    expect(after.identityProviderId).toBe(before.identityProviderId);
    expect(after.createdAt).toEqual(before.createdAt);
  });

  it('corrige aussi le profil d’un compte désactivé', async () => {
    const { handler, repo } = build();
    await seed(repo);
    const marie = (await repo.findById('user-marie'))!;
    marie.disable();
    await repo.save(marie);

    await handler.execute(commandFor('user-marie'));

    const corrected = (await repo.findById('user-marie'))!;
    expect(corrected.grade).toBe('Brigadier-chef');
    expect(corrected.status.getValue()).toBe(UserStatusEnum.DISABLED);
  });

  it('accepte une correction qui laisse le matricule inchangé', async () => {
    const { handler, repo } = build();
    await seed(repo);

    await handler.execute(
      commandFor('user-marie', { serviceNumber: 'PTS-0007' }),
    );

    expect((await repo.findById('user-marie'))!.grade).toBe('Brigadier-chef');
  });

  it("accepte une correction où le matricule ne change qu'aux espaces près", async () => {
    const { handler, repo } = build();
    await seed(repo);

    await handler.execute(
      commandFor('user-marie', { serviceNumber: '  PTS-0007  ' }),
    );

    const corrected = (await repo.findById('user-marie'))!;
    expect(corrected.serviceNumber).toBe('PTS-0007');
    expect(corrected.grade).toBe('Brigadier-chef');
  });

  it("n'envoie au fournisseur d'identité que des valeurs déjà nettoyées", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await handler.execute(
      commandFor('user-marie', {
        firstName: '  Nadia ',
        lastName: ' Belkacem  ',
      }),
    );

    expect(identity.renames).toEqual([
      {
        identityProviderId: 'kc-sub-marie',
        firstName: 'Nadia',
        lastName: 'Belkacem',
      },
    ]);
  });

  it('refuse un matricule déjà porté par un autre compte, sans rien changer', async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await expect(
      handler.execute(commandFor('user-marie', { serviceNumber: 'PTS-0001' })),
    ).rejects.toThrow(ServiceNumberAlreadyExistsError);
    expect(identity.renames).toEqual([]);
    expect((await repo.findById('user-marie'))!.serviceNumber).toBe('PTS-0007');
  });

  it.each([
    ['firstName vide', { firstName: '' }],
    ['firstName en espaces', { firstName: '   ' }],
    ['lastName vide', { lastName: '' }],
    ['lastName en espaces', { lastName: '  ' }],
    ['grade vide', { grade: '' }],
    ['grade en espaces', { grade: '\t' }],
    ['serviceNumber vide', { serviceNumber: '' }],
    ['serviceNumber en espaces', { serviceNumber: ' ' }],
  ])('refuse %s, sans rien changer', async (_label, override) => {
    const { handler, repo, identity } = build();
    await seed(repo);
    const before = (await repo.findById('user-marie'))!.toPrimitives();

    await expect(
      handler.execute(commandFor('user-marie', override)),
    ).rejects.toThrow(InvalidUserProfileError);
    expect(identity.renames).toEqual([]);
    expect((await repo.findById('user-marie'))!.toPrimitives()).toEqual(before);
  });

  it("refuse un identifiant introuvable, sans appeler le fournisseur d'identité", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await expect(handler.execute(commandFor('user-fantome'))).rejects.toThrow(
      ServiceAccountNotFoundError,
    );
    expect(identity.renames).toEqual([]);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    'refuse un appelant %s, sans rien changer',
    async (role) => {
      const { handler, repo, identity } = build();
      await seed(repo);

      await expect(
        handler.execute(
          commandFor('user-marie', {}, { id: 'user-marie', role }),
        ),
      ).rejects.toThrow(UserAdministrationNotAllowedError);
      expect(identity.renames).toEqual([]);
      expect((await repo.findById('user-marie'))!.grade).toBe('Technicien');
    },
  );

  it('laisse un responsable corriger son propre profil', async () => {
    const { handler, repo } = build();
    await seed(repo);

    await handler.execute(commandFor('user-chef'));

    expect((await repo.findById('user-chef'))!.grade).toBe('Brigadier-chef');
  });

  it('rend un nom accentué tel quel', async () => {
    const { handler, repo, identity } = build();
    await seed(repo);

    await handler.execute(commandFor('user-marie', { lastName: 'Nguyễn Đức' }));

    expect((await repo.findById('user-marie'))!.personalData.lastName).toBe(
      'Nguyễn Đức',
    );
    expect(identity.renames[0].lastName).toBe('Nguyễn Đức');
  });

  it('reste idempotent sur deux corrections identiques', async () => {
    const { handler, repo } = build();
    await seed(repo);

    await handler.execute(commandFor('user-marie'));
    const once = (await repo.findById('user-marie'))!.toPrimitives();
    await handler.execute(commandFor('user-marie'));

    const twice = (await repo.findById('user-marie'))!.toPrimitives();
    expect(twice).toEqual({ ...once, updatedAt: twice.updatedAt });
  });

  it("laisse la base intacte quand le fournisseur d'identité refuse", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);
    const panne = new Error('keycloak down');
    identity.failure = panne;

    await expect(handler.execute(commandFor('user-marie'))).rejects.toBe(panne);
    expect((await repo.findById('user-marie'))!.grade).toBe('Technicien');
  });

  it("rattrape la correction au rejeu quand l'écriture avait échoué", async () => {
    const { handler, repo, identity } = build();
    await seed(repo);
    repo.saveFailure = new Error('base indisponible');

    await expect(handler.execute(commandFor('user-marie'))).rejects.toThrow(
      'base indisponible',
    );
    expect((await repo.findById('user-marie'))!.grade).toBe('Technicien');

    repo.saveFailure = undefined;
    await handler.execute(commandFor('user-marie'));

    expect((await repo.findById('user-marie'))!.grade).toBe('Brigadier-chef');
    expect(identity.renames).toHaveLength(2);
  });
});
