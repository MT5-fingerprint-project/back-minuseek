import type { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import type { TenantRecord } from '../../../../tenancy/application/tenant-registry.service';
import type {
  CreateUserInput,
  CreatedUser,
  IdentityProviderPort,
  ListedUsers,
} from '../../ports/identity-provider.port';
import type { TenantDatabaseAdminPort } from '../../ports/tenant-database.port';
import type { OrganizationInitializerPort } from '../../ports/organization-initializer.port';
import {
  InvalidOrganizationSlugError,
  OrganizationAlreadyExistsError,
} from '../../organization.errors';
import { CreateOrganizationCommand } from './create-organization.command';
import { CreateOrganizationHandler } from './create-organization.handler';

const COMMAND = new CreateOrganizationCommand('labo-lyon', 'PTS Lyon');

class SagaJournal {
  readonly calls: string[] = [];
  failingStep: string | null = null;

  record(step: string): void {
    this.calls.push(step);
    if (step === this.failingStep) {
      throw new Error(`échec simulé: ${step}`);
    }
  }
}

class InMemoryIdentityProvider implements IdentityProviderPort {
  constructor(private readonly journal: SagaJournal) {}
  private readonly usersByRealm = new Map<string, string>();

  readonly preexistingRealms = new Set<string>();

  ensureRealm(realm: string): Promise<{ created: boolean }> {
    this.journal.record(`ensureRealm:${realm}`);
    return Promise.resolve({ created: !this.preexistingRealms.has(realm) });
  }

  deleteRealm(realm: string): Promise<void> {
    this.journal.record(`deleteRealm:${realm}`);
    return Promise.resolve();
  }

  listUsers(): Promise<ListedUsers> {
    return Promise.resolve({ items: [], total: 0 });
  }

  createUser(realm: string, input: CreateUserInput): Promise<CreatedUser> {
    this.journal.record(`createUser:${realm}`);
    const existing = this.usersByRealm.get(realm);
    if (existing) {
      return Promise.resolve({
        id: existing,
        username: existing,
        email: input.email,
        enabled: true,
        emailVerified: true,
        temporaryPassword: null,
      });
    }
    const username = input.email.split('@')[0];
    this.usersByRealm.set(realm, username);
    return Promise.resolve({
      id: username,
      username,
      email: input.email,
      enabled: true,
      emailVerified: true,
      temporaryPassword: 'tmp-secret',
    });
  }

  deleteUser(): Promise<void> {
    return Promise.resolve();
  }
}

class InMemoryDatabaseAdmin implements TenantDatabaseAdminPort {
  constructor(private readonly journal: SagaJournal) {}

  readonly preexistingDatabases = new Set<string>();

  ensureDatabase(databaseName: string): Promise<{ created: boolean }> {
    this.journal.record(`ensureDatabase:${databaseName}`);
    return Promise.resolve({
      created: !this.preexistingDatabases.has(databaseName),
    });
  }

  dropDatabase(databaseName: string): Promise<void> {
    this.journal.record(`dropDatabase:${databaseName}`);
    return Promise.resolve();
  }

  migrate(databaseName: string): Promise<void> {
    this.journal.record(`migrate:${databaseName}`);
    return Promise.resolve();
  }
}

class InMemoryInitializer implements OrganizationInitializerPort {
  constructor(private readonly journal: SagaJournal) {}

  initialize(databaseName: string): Promise<void> {
    this.journal.record(`initialize:${databaseName}`);
    return Promise.resolve();
  }
}

class InMemoryRegistry {
  constructor(private readonly journal: SagaJournal) {}
  private readonly rows = new Map<string, TenantRecord>();

  findBySlug(slug: string): Promise<TenantRecord | null> {
    return Promise.resolve(this.rows.get(slug) ?? null);
  }

  register(record: Omit<TenantRecord, 'id'>): Promise<TenantRecord> {
    this.journal.record(`register:${record.slug}`);
    const created = { id: `id-${record.slug}`, ...record };
    this.rows.set(record.slug, created);
    return Promise.resolve(created);
  }

  invalidate(): void {}
}

function buildHandler() {
  const journal = new SagaJournal();
  const registry = new InMemoryRegistry(journal);
  const identityProvider = new InMemoryIdentityProvider(journal);
  const databaseAdmin = new InMemoryDatabaseAdmin(journal);
  const handler = new CreateOrganizationHandler(
    registry as unknown as TenantRegistryService,
    identityProvider,
    databaseAdmin,
    new InMemoryInitializer(journal),
  );
  return { handler, journal, registry, identityProvider, databaseAdmin };
}

describe('CreateOrganizationHandler — chemin nominal', () => {
  it('déroule les étapes dans l’ordre du §7, registre EN DERNIER', async () => {
    const { handler, journal } = buildHandler();

    const provisioned = await handler.execute(COMMAND);

    expect(journal.calls).toEqual([
      'ensureRealm:minuseek-labo-lyon',
      'ensureDatabase:minuseek_labo_lyon',
      'migrate:minuseek_labo_lyon',
      'initialize:minuseek_labo_lyon',
      'register:labo-lyon',
    ]);
    expect(provisioned).toEqual({
      id: 'id-labo-lyon',
      slug: 'labo-lyon',
      realm: 'minuseek-labo-lyon',
      displayName: 'PTS Lyon',
      databaseName: 'minuseek_labo_lyon',
      identityProviderRealm: 'minuseek-labo-lyon',
    });
  });

  it('rend l’organisation résoluble par le registre après coup', async () => {
    const { handler, registry } = buildHandler();
    await handler.execute(COMMAND);
    await expect(registry.findBySlug('labo-lyon')).resolves.toMatchObject({
      databaseName: 'minuseek_labo_lyon',
      identityProviderRealm: 'minuseek-labo-lyon',
    });
  });
});

describe('CreateOrganizationHandler — validation', () => {
  it.each(['Labo Lyon', 'a'.repeat(64), '-labo', 'master', 'admin'])(
    'rejette le slug invalide ou réservé « %s » sans rien provisionner',
    async (slug) => {
      const { handler, journal } = buildHandler();
      await expect(
        handler.execute(new CreateOrganizationCommand(slug, 'X')),
      ).rejects.toThrow(InvalidOrganizationSlugError);
      expect(journal.calls).toEqual([]);
    },
  );

  it('rejette un slug déjà provisionné (conflit)', async () => {
    const { handler } = buildHandler();
    await handler.execute(COMMAND);
    await expect(handler.execute(COMMAND)).rejects.toThrow(
      OrganizationAlreadyExistsError,
    );
  });
});

describe('CreateOrganizationHandler — compensation', () => {
  it('défait realm et base en ordre inverse si les migrations échouent', async () => {
    const { handler, journal, registry } = buildHandler();
    journal.failingStep = 'migrate:minuseek_labo_lyon';

    await expect(handler.execute(COMMAND)).rejects.toThrow('échec simulé');

    expect(journal.calls).toEqual([
      'ensureRealm:minuseek-labo-lyon',
      'ensureDatabase:minuseek_labo_lyon',
      'migrate:minuseek_labo_lyon',
      // compensation en ordre INVERSE des étapes réussies
      'dropDatabase:minuseek_labo_lyon',
      'deleteRealm:minuseek-labo-lyon',
    ]);
    // Aucune ligne de registre : le tenant n'a jamais existé.
    await expect(registry.findBySlug('labo-lyon')).resolves.toBeNull();
  });

  it('ne supprime JAMAIS un realm pré-existant au rollback (régression)', async () => {
    const { handler, journal, identityProvider } = buildHandler();
    identityProvider.preexistingRealms.add('minuseek-labo-lyon');
    journal.failingStep = 'migrate:minuseek_labo_lyon';

    await expect(handler.execute(COMMAND)).rejects.toThrow('échec simulé');

    expect(journal.calls).toContain('dropDatabase:minuseek_labo_lyon');
    expect(journal.calls).not.toContain('deleteRealm:minuseek-labo-lyon');
  });

  it('ne supprime pas une base pré-existante au rollback (mais bien le realm créé)', async () => {
    const { handler, journal, databaseAdmin } = buildHandler();
    databaseAdmin.preexistingDatabases.add('minuseek_labo_lyon');
    journal.failingStep = 'migrate:minuseek_labo_lyon';

    await expect(handler.execute(COMMAND)).rejects.toThrow('échec simulé');

    expect(journal.calls).not.toContain('dropDatabase:minuseek_labo_lyon');
    expect(journal.calls).toContain('deleteRealm:minuseek-labo-lyon');
  });

  it('ne compense que le realm si la création de base échoue', async () => {
    const { handler, journal } = buildHandler();
    journal.failingStep = 'ensureDatabase:minuseek_labo_lyon';

    await expect(handler.execute(COMMAND)).rejects.toThrow('échec simulé');

    expect(journal.calls.slice(-1)).toEqual(['deleteRealm:minuseek-labo-lyon']);
    expect(journal.calls).not.toContain('dropDatabase:minuseek_labo_lyon');
  });

  it('reste rejouable après un échec partiel (idempotence de bout en bout)', async () => {
    const { handler, journal } = buildHandler();
    journal.failingStep = 'initialize:minuseek_labo_lyon';
    await expect(handler.execute(COMMAND)).rejects.toThrow('échec simulé');

    journal.failingStep = null;
    const provisioned = await handler.execute(COMMAND);
    expect(provisioned.slug).toBe('labo-lyon');
  });

  it('relance l’erreur d’origine même si une compensation échoue', async () => {
    class BrokenDropDatabaseAdmin extends InMemoryDatabaseAdmin {
      override dropDatabase(): Promise<void> {
        return Promise.reject(new Error('compensation cassée'));
      }
    }
    const journal = new SagaJournal();
    journal.failingStep = 'migrate:minuseek_labo_lyon';
    const handler = new CreateOrganizationHandler(
      new InMemoryRegistry(journal) as unknown as TenantRegistryService,
      new InMemoryIdentityProvider(journal),
      new BrokenDropDatabaseAdmin(journal),
      new InMemoryInitializer(journal),
    );

    await expect(handler.execute(COMMAND)).rejects.toThrow(
      'échec simulé: migrate',
    );
    // La compensation suivante a quand même tourné.
    expect(journal.calls).toContain('deleteRealm:minuseek-labo-lyon');
  });
});
