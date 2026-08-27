import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaCaseSubjectsReader } from './prisma-case-subjects.reader';

interface SubjectRow {
  id: string;
  caseId: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
  firstParentName: string | null;
  secondParentName: string | null;
  phoneNumber: string | null;
  sex: string;
  color: string | null;
  type: string;
  createdAt: Date;
}

function aSubjectRow(overrides: Partial<SubjectRow> = {}): SubjectRow {
  return {
    id: 'subject-1',
    caseId: 'case-9',
    firstName: 'Jean',
    lastName: 'Dupont',
    birthDate: new Date('1990-05-14'),
    birthPlace: 'Lyon',
    firstParentName: null,
    secondParentName: null,
    phoneNumber: null,
    sex: 'MALE',
    color: null,
    type: 'PERSON_OF_INTEREST',
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides,
  };
}

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(private readonly rows: SubjectRow[]) {}

  readonly subject = {
    findMany: (args: unknown): Promise<SubjectRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build(rows: SubjectRow[] = [aSubjectRow()]) {
  const prisma = new FakePrismaClient(rows);
  const openedClients: string[] = [];
  const tenantConnection = {
    getCurrentClient: () => {
      openedClients.push('current');
      return Promise.resolve(prisma as unknown as PrismaClient);
    },
    getClient: () => {
      openedClients.push('explicit');
      return Promise.resolve(prisma as unknown as PrismaClient);
    },
  } as unknown as TenantConnectionService;
  return {
    reader: new PrismaCaseSubjectsReader(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaCaseSubjectsReader', () => {
  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build();

    await reader.findByCaseId('case-9');

    expect(openedClients).toEqual(['current']);
  });

  it("ne demande que les personnes de l'affaire visée", async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-9');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: { caseId: 'case-9' },
    });
  });

  it('trie de la plus ancienne à la plus récente, puis départage par identifiant', async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-9');

    expect(prisma.findManyArgs[0]).toMatchObject({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it("ne rend pas l'affaire de rattachement, déjà connue de l'appelant", async () => {
    const { reader } = build();

    const [subject] = await reader.findByCaseId('case-9');

    expect(subject).not.toHaveProperty('caseId');
  });
});
