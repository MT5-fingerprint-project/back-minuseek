import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaCaseAccessReader } from './prisma-case-access.reader';

const MARIE = 'user-marie';
const PIERRE = 'user-pierre';

interface CaseRow {
  id: string;
  operatorUserId: string | null;
}

interface VerificationRow {
  caseId: string;
  verifierUserId: string;
  status: string;
}

interface FindManyArgs {
  where: { operatorUserId?: string };
}

interface FindFirstArgs {
  where: { id: string; operatorUserId: string };
}

interface VerificationFindArgs {
  where: { caseId?: string; verifierUserId?: string; status?: string };
}

function matches(row: VerificationRow, args: VerificationFindArgs): boolean {
  const { caseId, verifierUserId, status } = args.where;
  return (
    (caseId === undefined || row.caseId === caseId) &&
    (verifierUserId === undefined || row.verifierUserId === verifierUserId) &&
    (status === undefined || row.status === status)
  );
}

class FakePrismaClient {
  constructor(
    private readonly cases: CaseRow[],
    private readonly verifications: VerificationRow[],
  ) {}

  readonly investigationCase = {
    findFirst: (args: FindFirstArgs): Promise<{ id: string } | null> => {
      const found = this.cases.find(
        (row) =>
          row.id === args.where.id &&
          row.operatorUserId === args.where.operatorUserId,
      );
      return Promise.resolve(found ? { id: found.id } : null);
    },
    findMany: (args: FindManyArgs): Promise<{ id: string }[]> =>
      Promise.resolve(
        this.cases
          .filter((row) => row.operatorUserId === args.where.operatorUserId)
          .map((row) => ({ id: row.id })),
      ),
  };

  readonly caseVerification = {
    findFirst: (args: VerificationFindArgs): Promise<{ id: string } | null> => {
      const found = this.matching(args);
      return Promise.resolve(found ? { id: found.caseId } : null);
    },
    findMany: (
      args: VerificationFindArgs,
    ): Promise<{ caseId: string; status: string }[]> =>
      Promise.resolve(
        this.verifications
          .filter((row) => matches(row, args))
          .map((row) => ({ caseId: row.caseId, status: row.status })),
      ),
  };

  private matching(args: VerificationFindArgs): VerificationRow | undefined {
    return this.verifications.find((row) => matches(row, args));
  }
}

function build(cases: CaseRow[], verifications: VerificationRow[] = []) {
  const prisma = new FakePrismaClient(cases, verifications);
  const openedClients: string[] = [];
  const tenantConnection = {
    getCurrentClient: () => {
      openedClients.push('current');
      return Promise.resolve(prisma as unknown as PrismaClient);
    },
  } as unknown as TenantConnectionService;
  return {
    reader: new PrismaCaseAccessReader(tenantConnection),
    openedClients,
  };
}

describe('PrismaCaseAccessReader', () => {
  it("reconnaît l'opérateur d'une affaire", async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: MARIE }]);

    expect(await reader.findTitle(MARIE, 'case-1')).toBe('CASE_OPERATOR');
  });

  it("ne reconnaît pas un compte qui n'est pas l'opérateur de l'affaire", async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: MARIE }]);

    expect(await reader.findTitle(PIERRE, 'case-1')).toBeNull();
  });

  it("ne reconnaît pas un opérateur sur l'affaire d'un autre", async () => {
    const { reader } = build([
      { id: 'case-1', operatorUserId: MARIE },
      { id: 'case-2', operatorUserId: PIERRE },
    ]);

    expect(await reader.findTitle(MARIE, 'case-2')).toBeNull();
  });

  it('ne reconnaît personne sur une affaire sans opérateur', async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: null }]);

    expect(await reader.findTitle(MARIE, 'case-1')).toBeNull();
  });

  it("liste les affaires dont un compte est l'opérateur", async () => {
    const { reader } = build([
      { id: 'case-1', operatorUserId: MARIE },
      { id: 'case-2', operatorUserId: PIERRE },
      { id: 'case-3', operatorUserId: MARIE },
    ]);

    expect(await reader.findCaseIdsOf(MARIE)).toEqual(['case-1', 'case-3']);
  });

  it('rend une liste vide pour un compte sans affaire', async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: MARIE }]);

    expect(await reader.findCaseIdsOf(PIERRE)).toEqual([]);
  });

  it("reconnaît le vérificateur en mission sur une affaire qui n'est pas la sienne", async () => {
    const { reader } = build(
      [{ id: 'case-1', operatorUserId: MARIE }],
      [{ caseId: 'case-1', verifierUserId: PIERRE, status: 'PENDING' }],
    );

    expect(await reader.findTitle(PIERRE, 'case-1')).toBe('CASE_VERIFIER');
  });

  it('laisse relire le dossier au vérificateur dont la mission est close', async () => {
    const { reader } = build(
      [{ id: 'case-1', operatorUserId: MARIE }],
      [{ caseId: 'case-1', verifierUserId: PIERRE, status: 'CONCORDANT' }],
    );

    expect(await reader.findTitle(PIERRE, 'case-1')).toBe('CASE_VERIFIER');
  });

  it("ne reconnaît personne sur une affaire qu'il n'a jamais vérifiée", async () => {
    const { reader } = build(
      [{ id: 'case-1', operatorUserId: MARIE }],
      [{ caseId: 'case-2', verifierUserId: PIERRE, status: 'PENDING' }],
    );

    expect(await reader.findTitle(PIERRE, 'case-1')).toBeNull();
  });

  it("garde son titre d'opérateur à qui vérifie aussi une autre affaire", async () => {
    const { reader } = build(
      [{ id: 'case-1', operatorUserId: MARIE }],
      [{ caseId: 'case-2', verifierUserId: MARIE, status: 'PENDING' }],
    );

    expect(await reader.findTitle(MARIE, 'case-1')).toBe('CASE_OPERATOR');
  });

  it('ajoute les affaires à vérifier à celles dont on est opérateur', async () => {
    const { reader } = build(
      [
        { id: 'case-1', operatorUserId: MARIE },
        { id: 'case-2', operatorUserId: PIERRE },
      ],
      [{ caseId: 'case-2', verifierUserId: MARIE, status: 'PENDING' }],
    );

    expect(await reader.findCaseIdsOf(MARIE)).toEqual(['case-1', 'case-2']);
  });

  it('garde les affaires dont la mission est close dans la liste du vérificateur', async () => {
    const { reader } = build(
      [{ id: 'case-2', operatorUserId: PIERRE }],
      [{ caseId: 'case-2', verifierUserId: MARIE, status: 'DISCORDANT' }],
    );

    expect(await reader.findCaseIdsOf(MARIE)).toEqual(['case-2']);
  });

  it('ne liste pas deux fois une affaire vérifiée deux fois', async () => {
    const { reader } = build(
      [{ id: 'case-2', operatorUserId: PIERRE }],
      [
        { caseId: 'case-2', verifierUserId: MARIE, status: 'DISCORDANT' },
        { caseId: 'case-2', verifierUserId: MARIE, status: 'PENDING' },
      ],
    );

    expect(await reader.findCaseIdsOf(MARIE)).toEqual(['case-2']);
  });

  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build([
      { id: 'case-1', operatorUserId: MARIE },
    ]);

    await reader.findTitle(MARIE, 'case-1');
    await reader.findCaseIdsOf(MARIE);

    expect(openedClients).toEqual(['current', 'current']);
  });
});
