import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { PrismaInvestigationCaseReader } from './prisma-investigation-case.reader';

const MARIE = 'user-marie';

interface CaseRow {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operatorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  personalData: { firstName: string; lastName: string };
}

interface ExpertiseRow {
  caseId: string;
  expertUserId: string;
  courtReference: string;
  oathStatement: string;
  swornAt: Date;
}

function aCaseRow(overrides: Partial<CaseRow> = {}): CaseRow {
  return {
    id: 'case-1',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2024-001',
    description: null,
    status: InvestigationCaseStatusEnum.OPEN,
    operatorUserId: MARIE,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

class FakePrismaClient {
  readonly userFindManyArgs: unknown[] = [];
  readonly caseFindManyArgs: unknown[] = [];

  constructor(
    private readonly cases: CaseRow[],
    private readonly users: UserRow[],
    private readonly expertises: ExpertiseRow[] = [],
  ) {}

  readonly investigationCase = {
    findMany: (args: unknown): Promise<CaseRow[]> => {
      this.caseFindManyArgs.push(args);
      return Promise.resolve(this.cases);
    },
    count: (): Promise<number> => Promise.resolve(this.cases.length),
    findUnique: (args: { where: { id: string } }): Promise<CaseRow | null> =>
      Promise.resolve(
        this.cases.find((row) => row.id === args.where.id) ?? null,
      ),
  };

  readonly user = {
    findMany: (args: unknown): Promise<UserRow[]> => {
      this.userFindManyArgs.push(args);
      return Promise.resolve(this.users);
    },
  };

  readonly caseExpertise = {
    findMany: (args: {
      where: { caseId: { in: string[] } };
    }): Promise<ExpertiseRow[]> =>
      Promise.resolve(
        this.expertises.filter((row) =>
          args.where.caseId.in.includes(row.caseId),
        ),
      ),
  };
}

const MARIE_ROW: UserRow = {
  id: MARIE,
  personalData: { firstName: 'Marie', lastName: 'Curie' },
};

const SERMENT =
  'Je soussigné Marie Curie, expert désigné, prête serment de bien et ' +
  'fidèlement remplir ma mission en mon honneur et conscience.';

const UNE_EXPERTISE: ExpertiseRow = {
  caseId: 'case-1',
  expertUserId: MARIE,
  courtReference: 'Tribunal judiciaire de Paris',
  oathStatement: SERMENT,
  swornAt: new Date('2026-03-04T09:00:00Z'),
};

function build(
  cases: CaseRow[] = [aCaseRow()],
  users: UserRow[] = [MARIE_ROW],
  expertises: ExpertiseRow[] = [],
) {
  const prisma = new FakePrismaClient(cases, users, expertises);
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  return {
    prisma,
    reader: new PrismaInvestigationCaseReader(tenantConnection),
  };
}

describe('PrismaInvestigationCaseReader', () => {
  it("rend l'opérateur du dossier avec son nom lisible", async () => {
    const { reader } = build();

    const found = await reader.findById('case-1');

    expect(found!.operator).toEqual({
      id: MARIE,
      firstName: 'Marie',
      lastName: 'Curie',
    });
  });

  it("rend l'opérateur de chaque dossier de la liste", async () => {
    const { reader } = build();

    const { items } = await reader.findAll(
      { caseIds: null },
      { skip: 0, take: 20 },
    );

    expect(items[0].operator).toMatchObject({ lastName: 'Curie' });
  });

  it("rend un opérateur nul sur un dossier qui n'en porte pas", async () => {
    const { reader } = build([aCaseRow({ operatorUserId: null })], []);

    const found = await reader.findById('case-1');

    expect(found!.operator).toBeNull();
  });

  it("rend un opérateur nul quand le compte désigné n'existe plus", async () => {
    const { reader } = build([aCaseRow()], []);

    const found = await reader.findById('case-1');

    expect(found!.operator).toBeNull();
  });

  it("n'interroge pas les comptes quand aucun dossier ne porte d'opérateur", async () => {
    const { reader, prisma } = build([aCaseRow({ operatorUserId: null })], []);

    await reader.findAll({ caseIds: null }, { skip: 0, take: 20 });

    expect(prisma.userFindManyArgs).toHaveLength(0);
  });

  it("ne demande qu'une fois un opérateur partagé par plusieurs dossiers", async () => {
    const { reader, prisma } = build(
      [aCaseRow(), aCaseRow({ id: 'case-2', caseNumber: 'AFF-002' })],
      [MARIE_ROW],
    );

    await reader.findAll({ caseIds: null }, { skip: 0, take: 20 });

    expect(prisma.userFindManyArgs[0]).toMatchObject({
      where: { id: { in: [MARIE] } },
    });
  });

  it("descend la liste des affaires visibles jusqu'au where, pas après la pagination", async () => {
    const { reader, prisma } = build();

    await reader.findAll(
      { caseIds: ['case-1', 'case-2'] },
      { skip: 0, take: 20 },
    );

    expect(prisma.caseFindManyArgs[0]).toMatchObject({
      where: { id: { in: ['case-1', 'case-2'] } },
    });
  });

  it("ne filtre pas quand l'appelant voit tout le service", async () => {
    const { reader, prisma } = build();

    await reader.findAll({ caseIds: null }, { skip: 0, take: 20 });

    expect(prisma.caseFindManyArgs[0]).toEqual({
      where: {},
      skip: 0,
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('départage par identifiant deux affaires ouvertes dans la même seconde', async () => {
    const { reader, prisma } = build();

    await reader.findAll({ caseIds: null }, { skip: 0, take: 20 });

    expect(prisma.caseFindManyArgs[0]).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it("rend une expertise nulle sur un dossier qui n'en porte pas", async () => {
    const { reader } = build();

    const found = await reader.findById('case-1');

    expect(found!.expertise).toBeNull();
  });

  it("rend le serment et l'expert du dossier déclaré en expertise", async () => {
    const { reader } = build([aCaseRow()], [MARIE_ROW], [UNE_EXPERTISE]);

    const found = await reader.findById('case-1');

    expect(found!.expertise).toEqual({
      expert: { id: MARIE, firstName: 'Marie', lastName: 'Curie' },
      courtReference: 'Tribunal judiciaire de Paris',
      oathStatement: SERMENT,
      swornAt: new Date('2026-03-04T09:00:00Z'),
    });
  });

  it('rend le serment mot pour mot, sans le retailler', async () => {
    const brut = `  ${SERMENT}\n`;
    const { reader } = build(
      [aCaseRow()],
      [MARIE_ROW],
      [{ ...UNE_EXPERTISE, oathStatement: brut }],
    );

    const found = await reader.findById('case-1');

    expect(found!.expertise!.oathStatement).toBe(brut);
  });

  it("interroge le compte de l'expert même quand le dossier n'a plus d'opérateur", async () => {
    const { reader, prisma } = build(
      [aCaseRow({ operatorUserId: null })],
      [MARIE_ROW],
      [UNE_EXPERTISE],
    );

    const found = await reader.findById('case-1');

    expect(prisma.userFindManyArgs).toHaveLength(1);
    expect(found!.expertise!.expert).toMatchObject({ lastName: 'Curie' });
  });

  it("n'attache l'expertise qu'au dossier qui la porte", async () => {
    const { reader } = build(
      [aCaseRow(), aCaseRow({ id: 'case-2', caseNumber: 'AFF-002' })],
      [MARIE_ROW],
      [UNE_EXPERTISE],
    );

    const { items } = await reader.findAll(
      { caseIds: null },
      { skip: 0, take: 20 },
    );

    expect(
      items.find((item) => item.id === 'case-1')!.expertise,
    ).not.toBeNull();
    expect(items.find((item) => item.id === 'case-2')!.expertise).toBeNull();
  });

  it("rend null quand le dossier demandé n'existe pas", async () => {
    const { reader } = build();

    expect(await reader.findById('case-fantome')).toBeNull();
  });
});
