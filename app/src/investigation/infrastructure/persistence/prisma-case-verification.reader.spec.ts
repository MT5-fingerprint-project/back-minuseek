import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { VerificationStatusEnum } from '../../domain/case-verification/value-objects/verification-status.vo';
import { PrismaCaseVerificationReader } from './prisma-case-verification.reader';

const LUCIE = 'user-lucie';

interface VerificationRow {
  id: string;
  caseId: string;
  verifierUserId: string;
  requestedByUserId: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
}

interface UserRow {
  id: string;
  personalData: { firstName: string; lastName: string };
}

function aVerificationRow(
  overrides: Partial<VerificationRow> = {},
): VerificationRow {
  return {
    id: 'verification-1',
    caseId: 'case-1',
    verifierUserId: LUCIE,
    requestedByUserId: 'user-marie',
    status: VerificationStatusEnum.PENDING,
    requestedAt: new Date('2026-08-20T10:00:00.000Z'),
    completedAt: null,
    ...overrides,
  };
}

class FakePrismaClient {
  readonly verificationFindManyArgs: unknown[] = [];

  constructor(
    private readonly verifications: VerificationRow[],
    private readonly users: UserRow[],
  ) {}

  readonly caseVerification = {
    findMany: (args: unknown): Promise<VerificationRow[]> => {
      this.verificationFindManyArgs.push(args);
      return Promise.resolve(this.verifications);
    },
  };

  readonly investigationCase = {
    findMany: (): Promise<{ id: string; caseNumber: string }[]> =>
      Promise.resolve([{ id: 'case-1', caseNumber: 'AFF-001' }]),
  };

  readonly user = {
    findMany: (): Promise<UserRow[]> => Promise.resolve(this.users),
  };
}

const LUCIE_ROW: UserRow = {
  id: LUCIE,
  personalData: { firstName: 'Lucie', lastName: 'Bernard' },
};

function build(
  verifications: VerificationRow[] = [aVerificationRow()],
  users: UserRow[] = [LUCIE_ROW],
) {
  const prisma = new FakePrismaClient(verifications, users);
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  return {
    prisma,
    reader: new PrismaCaseVerificationReader(tenantConnection),
  };
}

describe('PrismaCaseVerificationReader', () => {
  it("rend le numéro de l'affaire et le nom du vérificateur", async () => {
    const { reader } = build();

    const [mission] = await reader.findByCaseId('case-1');

    expect(mission).toEqual({
      id: 'verification-1',
      caseId: 'case-1',
      caseNumber: 'AFF-001',
      verifierUserId: LUCIE,
      verifier: { firstName: 'Lucie', lastName: 'Bernard' },
      status: VerificationStatusEnum.PENDING,
      requestedAt: new Date('2026-08-20T10:00:00.000Z'),
      completedAt: null,
    });
  });

  it("rend un vérificateur nul quand le compte n'existe plus", async () => {
    const { reader } = build([aVerificationRow()], []);

    const [mission] = await reader.findByCaseId('case-1');

    expect(mission.verifier).toBeNull();
  });

  it("départage les missions d'une même seconde par leur identifiant", async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-1');

    expect(prisma.verificationFindManyArgs[0]).toMatchObject({
      orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('lit toutes les missions de la personne, closes comprises', async () => {
    const { reader, prisma } = build();

    await reader.findForVerifier(LUCIE);

    expect(prisma.verificationFindManyArgs[0]).toEqual({
      where: { verifierUserId: LUCIE },
      orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
    });
  });

  it("n'interroge ni les affaires ni les comptes quand il n'y a aucune mission", async () => {
    const { reader } = build([], []);

    expect(await reader.findForVerifier(LUCIE)).toEqual([]);
  });
});
