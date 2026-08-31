import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaServiceActivityReader } from './prisma-service-activity.reader';

const MAINTENANT = new Date('2026-08-30T12:00:00Z');
const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

function jours(nombre: number): Date {
  return new Date(MAINTENANT.getTime() - nombre * MILLISECONDES_PAR_JOUR);
}

function dans(nombre: number): Date {
  return new Date(MAINTENANT.getTime() + nombre * MILLISECONDES_PAR_JOUR);
}

interface CaseSeed {
  id: string;
  caseNumber: string;
  status: string;
  operatorUserId: string | null;
  closedAt: Date | null;
  createdAt: Date;
}

interface AuditEventSeed {
  caseId: string | null;
  occurredAt: Date;
}

interface UserSeed {
  id: string;
  role: string;
  status: string;
  firstName: string;
  lastName: string;
}

interface TraceSeed {
  id: string;
  caseId: string;
  status: string;
  createdAt: Date;
  withdrawnAt?: Date;
}

interface ComparisonSeed {
  traceId: string;
  createdAt: Date;
  withdrawnAt?: Date;
}

interface ExpertiseSeed {
  caseId: string;
  prorogationDeadline: Date | null;
}

interface Seed {
  cases: CaseSeed[];
  auditEvents: AuditEventSeed[];
  users: UserSeed[];
  traces: TraceSeed[];
  matchings: ComparisonSeed[];
  hits: ComparisonSeed[];
  expertises: ExpertiseSeed[];
}

interface CaseWhere {
  status?: string | { not: string };
  id?: { in: string[] };
  createdAt?: { gte: Date };
  closedAt?: { gte: Date };
  operatorUserId?: string;
}

interface AuditEventWhere {
  caseId?: { in: string[] };
}

interface TraceWhere {
  caseId?: { in: string[] };
  status?: string;
  createdAt?: { gte: Date };
  withdrawnAt?: null;
}

interface ComparisonWhere {
  traceId?: { in: string[] };
  trace?: TraceWhere;
  withdrawnAt?: null;
}

interface ExpertiseWhere {
  caseId: { in: string[] };
  prorogationDeadline: { not: null; lte: Date };
}

interface UserWhere {
  OR: [{ role: { in: string[] } }, { id: { in: string[] } }];
}

function matchesCase(row: CaseSeed, where: CaseWhere = {}): boolean {
  if (typeof where.status === 'string' && row.status !== where.status) {
    return false;
  }
  if (typeof where.status === 'object' && row.status === where.status.not) {
    return false;
  }
  if (where.id && !where.id.in.includes(row.id)) return false;
  if (where.createdAt && row.createdAt < where.createdAt.gte) return false;
  if (
    where.closedAt &&
    (row.closedAt === null || row.closedAt < where.closedAt.gte)
  ) {
    return false;
  }
  if (
    where.operatorUserId !== undefined &&
    row.operatorUserId !== where.operatorUserId
  ) {
    return false;
  }
  return true;
}

function matchesAuditEvent(
  row: AuditEventSeed,
  where: AuditEventWhere = {},
): boolean {
  if (!where.caseId) return true;
  return row.caseId !== null && where.caseId.in.includes(row.caseId);
}

function matchesTrace(row: TraceSeed, where: TraceWhere = {}): boolean {
  if (where.status && row.status !== where.status) return false;
  if (where.createdAt && row.createdAt < where.createdAt.gte) return false;
  if (where.caseId && !where.caseId.in.includes(row.caseId)) return false;
  if ('withdrawnAt' in where && row.withdrawnAt !== undefined) return false;
  return true;
}

class FakePrismaClient {
  constructor(private readonly seed: Seed) {}

  readonly investigationCase = {
    findMany: (args: { where?: CaseWhere }): Promise<CaseSeed[]> =>
      Promise.resolve(
        this.seed.cases.filter((row) => matchesCase(row, args.where)),
      ),
  };

  readonly auditEvent = {
    groupBy: (args: {
      where?: AuditEventWhere;
    }): Promise<{ caseId: string | null; _max: { occurredAt: Date } }[]> => {
      const latest = new Map<string | null, Date>();
      for (const row of this.seed.auditEvents) {
        if (!matchesAuditEvent(row, args.where)) continue;
        const known = latest.get(row.caseId);
        if (!known || row.occurredAt > known)
          latest.set(row.caseId, row.occurredAt);
      }
      return Promise.resolve(
        [...latest].map(([caseId, occurredAt]) => ({
          caseId,
          _max: { occurredAt },
        })),
      );
    },
  };

  readonly user = {
    findUnique: (args: {
      where: { id: string };
    }): Promise<{ id: string } | null> =>
      Promise.resolve(
        this.seed.users.find((row) => row.id === args.where.id) ?? null,
      ),

    findMany: (args: {
      where: UserWhere;
    }): Promise<
      { id: string; personalData: { firstName: string; lastName: string } }[]
    > => {
      const [byRole, byId] = args.where.OR;
      return Promise.resolve(
        this.seed.users
          .filter(
            (row) =>
              byRole.role.in.includes(row.role) || byId.id.in.includes(row.id),
          )
          .map((row) => ({
            id: row.id,
            personalData: { firstName: row.firstName, lastName: row.lastName },
          })),
      );
    },
  };

  readonly trace = {
    count: (args: { where?: TraceWhere }): Promise<number> =>
      Promise.resolve(
        this.seed.traces.filter((row) => matchesTrace(row, args.where)).length,
      ),

    findMany: (args: { where?: TraceWhere }): Promise<{ id: string }[]> =>
      Promise.resolve(
        this.seed.traces
          .filter((row) => matchesTrace(row, args.where))
          .map((row) => ({ id: row.id })),
      ),
  };

  readonly matching = {
    groupBy: (args: {
      where?: ComparisonWhere;
    }): Promise<{ traceId: string }[]> =>
      Promise.resolve(this.distinctTraces(this.seed.matchings, args.where)),
  };

  readonly hit = {
    groupBy: (args: {
      where?: ComparisonWhere;
    }): Promise<{ traceId: string }[]> =>
      Promise.resolve(this.distinctTraces(this.seed.hits, args.where)),
  };

  readonly caseExpertise = {
    count: (args: { where: ExpertiseWhere }): Promise<number> =>
      Promise.resolve(
        this.seed.expertises.filter(
          (row) =>
            args.where.caseId.in.includes(row.caseId) &&
            row.prorogationDeadline !== null &&
            row.prorogationDeadline <= args.where.prorogationDeadline.lte,
        ).length,
      ),
  };

  private distinctTraces(
    rows: ComparisonSeed[],
    where: ComparisonWhere = {},
  ): { traceId: string }[] {
    const kept = new Set<string>();
    for (const row of rows) {
      if (where.traceId && !where.traceId.in.includes(row.traceId)) continue;
      if ('withdrawnAt' in where && row.withdrawnAt !== undefined) continue;
      if (where.trace) {
        const trace = this.seed.traces.find((seed) => seed.id === row.traceId);
        if (!trace || !matchesTrace(trace, where.trace)) continue;
      }
      kept.add(row.traceId);
    }
    return [...kept].map((traceId) => ({ traceId }));
  }
}

function build(seed: Partial<Seed> = {}): PrismaServiceActivityReader {
  const prisma = new FakePrismaClient({
    cases: [],
    auditEvents: [],
    users: [],
    traces: [],
    matchings: [],
    hits: [],
    expertises: [],
    ...seed,
  });
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  return new PrismaServiceActivityReader(tenantConnection);
}

const NADIA: UserSeed = {
  id: 'nadia',
  role: 'OPERATOR',
  status: 'ACTIVE',
  firstName: 'Nadia',
  lastName: 'Berthier',
};

const MARC: UserSeed = {
  id: 'marc',
  role: 'OPERATOR',
  status: 'ACTIVE',
  firstName: 'Marc',
  lastName: 'Olivier',
};

function unDossier(overrides: Partial<CaseSeed> = {}): CaseSeed {
  return {
    id: 'case-1',
    caseNumber: 'AFF-001',
    status: 'OPEN',
    operatorUserId: NADIA.id,
    closedAt: null,
    createdAt: jours(10),
    ...overrides,
  };
}

function acte(caseId: string, occurredAt: Date): AuditEventSeed {
  return { caseId, occurredAt };
}

function dossiersClos(nombre: number, operatorUserId: string): CaseSeed[] {
  return Array.from({ length: nombre }, (_, rang) =>
    unDossier({
      id: `${operatorUserId}-clos-${rang}`,
      caseNumber: `AFF-C${rang}`,
      status: 'CLOSED',
      operatorUserId,
      createdAt: jours(50 + rang),
      closedAt: jours(10),
    }),
  );
}

describe('PrismaServiceActivityReader', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MAINTENANT);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("l'année civile en cours", () => {
    it("commence au 1er janvier de Paris et s'arrête à l'instant de la lecture", async () => {
      const lecture = await build().read(null);

      expect(lecture.period).toEqual({
        from: new Date('2025-12-31T23:00:00Z'),
        to: MAINTENANT,
      });
    });

    it('déroule un mois par mois écoulé, à zéro quand rien ne bouge', async () => {
      const lecture = await build().read(null);

      expect(lecture.cases.monthlyFlow).toHaveLength(8);
      expect(lecture.cases.monthlyFlow[0]).toEqual({
        month: '2026-01',
        opened: 0,
        closed: 0,
      });
    });

    it('range un dossier ouvert le 1er février à 00 h 30 de Paris en février', async () => {
      const lecture = await build({
        cases: [unDossier({ createdAt: new Date('2026-01-31T23:30:00Z') })],
      }).read(null);

      const parMois = new Map(
        lecture.cases.monthlyFlow.map((mois) => [mois.month, mois.opened]),
      );
      expect(parMois.get('2026-01')).toBe(0);
      expect(parMois.get('2026-02')).toBe(1);
    });
  });

  describe('les dossiers en cours', () => {
    it('rend la liste du plus ancien au plus récent, avec son âge et son dernier acte', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({
            id: 'case-1',
            caseNumber: 'AFF-001',
            createdAt: jours(3),
          }),
          unDossier({
            id: 'case-2',
            caseNumber: 'AFF-002',
            createdAt: jours(12),
          }),
        ],
        auditEvents: [acte('case-1', jours(3)), acte('case-2', jours(12))],
      }).read(null);

      expect(lecture.cases.open).toBe(2);
      expect(lecture.cases.openCases).toEqual([
        {
          id: 'case-2',
          caseNumber: 'AFF-002',
          openedAt: jours(12),
          ageInDays: 12,
          operator: { id: 'nadia', firstName: 'Nadia', lastName: 'Berthier' },
          lastActivityAt: jours(12),
        },
        {
          id: 'case-1',
          caseNumber: 'AFF-001',
          openedAt: jours(3),
          ageInDays: 3,
          operator: { id: 'nadia', firstName: 'Nadia', lastName: 'Berthier' },
          lastActivityAt: jours(3),
        },
      ]);
    });

    it('compte à part ceux qui dépassent quatre-vingt-dix jours, la borne exclue', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({ id: 'case-1', createdAt: jours(120) }),
          unDossier({ id: 'case-2', createdAt: jours(90) }),
          unDossier({ id: 'case-3', createdAt: jours(2) }),
        ],
      }).read(null);

      expect(lecture.cases.open).toBe(3);
      expect(lecture.cases.openOver90Days).toBe(1);
    });

    it('garde dans la liste un dossier sans opérateur, avec un opérateur nul', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier({ operatorUserId: null })],
      }).read(null);

      expect(lecture.cases.openCases).toHaveLength(1);
      expect(lecture.cases.openCases[0].operator).toBeNull();
      expect(lecture.signals.openWithoutOperator).toBe(1);
    });
  });

  describe('les dossiers clos', () => {
    it('ne compte pas un dossier rouvert et le remet dans les dossiers en cours', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({ id: 'case-1', status: 'IN_PROGRESS', closedAt: null }),
        ],
      }).read(null);

      expect(lecture.cases.closedInPeriod).toBe(0);
      expect(lecture.cases.medianClosureDays).toBeNull();
      expect(lecture.cases.openCases.map((row) => row.id)).toEqual(['case-1']);
    });

    it("compte le délai depuis l'ouverture jusqu'à la date de clôture portée", async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({
            id: 'case-1',
            status: 'CLOSED',
            createdAt: jours(100),
            closedAt: jours(20),
          }),
        ],
      }).read(null);

      expect(lecture.cases.closedInPeriod).toBe(1);
      expect(lecture.cases.medianClosureDays).toBe(80);
      expect(lecture.cases.ninthDecileClosureDays).toBe(80);
    });

    it('laisse hors période un dossier clos avant le 1er janvier', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({
            id: 'case-1',
            status: 'CLOSED',
            createdAt: new Date('2025-03-01T10:00:00Z'),
            closedAt: new Date('2025-11-02T10:00:00Z'),
          }),
        ],
      }).read(null);

      expect(lecture.cases.closedInPeriod).toBe(0);
      expect(lecture.cases.medianClosureDays).toBeNull();
    });

    it('rend la médiane et le neuvième décile des délais de traitement', async () => {
      const cases = Array.from({ length: 4 }, (_, index) =>
        unDossier({
          id: `case-${index}`,
          status: 'CLOSED',
          createdAt: jours(10 * (index + 1) + 10),
          closedAt: jours(10),
        }),
      );

      const lecture = await build({ users: [NADIA], cases }).read(null);

      expect(lecture.cases.closedInPeriod).toBe(4);
      expect(lecture.cases.medianClosureDays).toBe(25);
      expect(lecture.cases.ninthDecileClosureDays).toBeCloseTo(37);
    });

    it('compte les dossiers ouverts dans la période, clos compris', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({ id: 'case-1', createdAt: jours(5) }),
          unDossier({
            id: 'case-2',
            status: 'CLOSED',
            createdAt: jours(20),
            closedAt: jours(10),
          }),
          unDossier({
            id: 'case-3',
            createdAt: new Date('2025-06-01T10:00:00Z'),
          }),
        ],
      }).read(null);

      expect(lecture.cases.openedInPeriod).toBe(2);
    });
  });

  describe('les étapes des traces', () => {
    it("ne compte qu'une fois une trace identifiée sur deux empreintes", async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-1',
            caseId: 'case-1',
            status: 'RECEIVED',
            createdAt: jours(5),
          },
        ],
        hits: [
          { traceId: 'trace-1', createdAt: jours(4) },
          { traceId: 'trace-1', createdAt: jours(3) },
        ],
      }).read(null);

      expect(lecture.traces.collected).toBe(1);
      expect(lecture.traces.identified).toBe(1);
    });

    it("ne compte qu'une fois une trace comparée à dix empreintes", async () => {
      const matchings = Array.from({ length: 10 }, (_, rang) => ({
        traceId: 'trace-1',
        createdAt: jours(rang + 1),
      }));

      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-1',
            caseId: 'case-1',
            status: 'RECEIVED',
            createdAt: jours(5),
          },
        ],
        matchings,
      }).read(null);

      expect(lecture.traces.compared).toBe(1);
    });

    it('compte les traces déclarées exploitables', async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-1',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: jours(5),
          },
          {
            id: 'trace-2',
            caseId: 'case-1',
            status: 'RECEIVED',
            createdAt: jours(5),
          },
        ],
      }).read(null);

      expect(lecture.traces.collected).toBe(2);
      expect(lecture.traces.exploitable).toBe(1);
    });

    it('ne compte nulle part une pièce retirée du dossier', async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-retiree',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: jours(5),
            withdrawnAt: jours(1),
          },
          {
            id: 'trace-gardee',
            caseId: 'case-1',
            status: 'RECEIVED',
            createdAt: jours(5),
          },
        ],
        matchings: [{ traceId: 'trace-retiree', createdAt: jours(4) }],
        hits: [
          {
            traceId: 'trace-gardee',
            createdAt: jours(3),
            withdrawnAt: jours(1),
          },
        ],
      }).read(null);

      expect(lecture.traces).toEqual({
        collected: 1,
        exploitable: 0,
        compared: 0,
        identified: 0,
      });
      expect(lecture.signals.exploitableNeverCompared).toBe(0);
    });

    it("laisse hors période une trace relevée l'an dernier", async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-1',
            caseId: 'case-1',
            status: 'RECEIVED',
            createdAt: new Date('2025-11-02T09:00:00Z'),
          },
        ],
      }).read(null);

      expect(lecture.traces.collected).toBe(0);
    });

    it("tient les quatre étapes hors d'une trace déposée l'an dernier et confrontée cette année", async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-1',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: new Date('2025-11-02T09:00:00Z'),
          },
        ],
        matchings: [{ traceId: 'trace-1', createdAt: jours(5) }],
        hits: [{ traceId: 'trace-1', createdAt: jours(4) }],
      }).read(null);

      expect(lecture.traces).toEqual({
        collected: 0,
        exploitable: 0,
        compared: 0,
        identified: 0,
      });
    });

    it('ne laisse aucune étape dépasser le nombre de traces relevées', async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-de-l-an-dernier',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: new Date('2025-12-04T09:00:00Z'),
          },
          {
            id: 'trace-de-l-annee',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: jours(20),
          },
        ],
        matchings: [
          { traceId: 'trace-de-l-an-dernier', createdAt: jours(9) },
          { traceId: 'trace-de-l-annee', createdAt: jours(8) },
        ],
        hits: [
          { traceId: 'trace-de-l-an-dernier', createdAt: jours(7) },
          { traceId: 'trace-de-l-annee', createdAt: jours(6) },
        ],
      }).read(null);

      const { collected, exploitable, compared, identified } = lecture.traces;
      expect(collected).toBe(1);
      expect([exploitable, compared, identified]).toEqual([1, 1, 1]);
    });
  });

  describe('les signaux qui demandent une décision', () => {
    it('tient pour dormant un dossier dont le seul acte remonte à quarante jours', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier({ createdAt: jours(40) })],
        auditEvents: [acte('case-1', jours(40))],
      }).read(null);

      expect(lecture.signals.dormantOver30Days).toBe(1);
    });

    it('ne tient pas pour dormant le même dossier dix jours après son ouverture', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier({ createdAt: jours(10) })],
        auditEvents: [acte('case-1', jours(10))],
      }).read(null);

      expect(lecture.signals.dormantOver30Days).toBe(0);
    });

    it("ne compte jamais une expertise dont l'échéance n'a pas été saisie", async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier()],
        expertises: [{ caseId: 'case-1', prorogationDeadline: null }],
      }).read(null);

      expect(lecture.signals.expertiseDeadlinesUnder15Days).toBe(0);
    });

    it('compte une échéance déjà dépassée comme une échéance qui approche', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier()],
        expertises: [{ caseId: 'case-1', prorogationDeadline: jours(3) }],
      }).read(null);

      expect(lecture.signals.expertiseDeadlinesUnder15Days).toBe(1);
    });

    it('laisse de côté une échéance qui tombe au-delà de quinze jours', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier()],
        expertises: [{ caseId: 'case-1', prorogationDeadline: dans(40) }],
      }).read(null);

      expect(lecture.signals.expertiseDeadlinesUnder15Days).toBe(0);
    });

    it("laisse de côté l'expertise d'un dossier clos", async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier({ status: 'CLOSED', closedAt: jours(5) })],
        expertises: [{ caseId: 'case-1', prorogationDeadline: dans(3) }],
      }).read(null);

      expect(lecture.signals.expertiseDeadlinesUnder15Days).toBe(0);
    });

    it('ne retient que les traces exploitables jamais confrontées', async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-comparee',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: jours(5),
          },
          {
            id: 'trace-en-attente',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: jours(5),
          },
          {
            id: 'trace-recue',
            caseId: 'case-1',
            status: 'RECEIVED',
            createdAt: jours(5),
          },
        ],
        matchings: [{ traceId: 'trace-comparee', createdAt: jours(4) }],
      }).read(null);

      expect(lecture.signals.exploitableNeverCompared).toBe(1);
    });

    it('ne remet pas à faire une trace confrontée avant le 1er janvier', async () => {
      const lecture = await build({
        cases: [unDossier()],
        traces: [
          {
            id: 'trace-1',
            caseId: 'case-1',
            status: 'EXPLOITABLE',
            createdAt: new Date('2025-10-01T09:00:00Z'),
          },
        ],
        matchings: [
          { traceId: 'trace-1', createdAt: new Date('2025-10-02T09:00:00Z') },
        ],
      }).read(null);

      expect(lecture.signals.exploitableNeverCompared).toBe(0);
    });
  });

  describe("le filtre d'opérateur", () => {
    const SEED: Partial<Seed> = {
      users: [NADIA, MARC],
      cases: [
        unDossier({ id: 'case-nadia', operatorUserId: NADIA.id }),
        unDossier({
          id: 'case-marc',
          caseNumber: 'AFF-002',
          operatorUserId: MARC.id,
        }),
        unDossier({
          id: 'case-orphelin',
          caseNumber: 'AFF-003',
          operatorUserId: null,
        }),
      ],
      traces: [
        {
          id: 'trace-nadia',
          caseId: 'case-nadia',
          status: 'RECEIVED',
          createdAt: jours(5),
        },
        {
          id: 'trace-marc',
          caseId: 'case-marc',
          status: 'RECEIVED',
          createdAt: jours(5),
        },
      ],
      hits: [{ traceId: 'trace-marc', createdAt: jours(4) }],
    };

    it("restreint les dossiers et les traces aux affaires de l'opérateur", async () => {
      const lecture = await build(SEED).read(NADIA.id);

      expect(lecture.cases.open).toBe(1);
      expect(lecture.cases.openCases.map((row) => row.id)).toEqual([
        'case-nadia',
      ]);
      expect(lecture.traces.collected).toBe(1);
      expect(lecture.traces.identified).toBe(0);
    });

    it('ne laisse aucun dossier sans opérateur dans un périmètre filtré', async () => {
      const lecture = await build(SEED).read(NADIA.id);

      expect(lecture.signals.openWithoutOperator).toBe(0);
    });

    it("rend le service entier quand aucun opérateur n'est passé", async () => {
      const lecture = await build(SEED).read(null);

      expect(lecture.cases.open).toBe(3);
      expect(lecture.traces.collected).toBe(2);
      expect(lecture.signals.openWithoutOperator).toBe(1);
    });

    it('garde toutes les lignes du service dans la répartition', async () => {
      const lecture = await build(SEED).read(NADIA.id);

      expect(
        lecture.byOperator.map((ligne) => ligne.operator?.id ?? null),
      ).toEqual([NADIA.id, MARC.id, null]);
    });
  });

  describe('la charge et le délai de chaque opérateur', () => {
    it('rend un délai médian nul en dessous de dix clôtures', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: dossiersClos(9, NADIA.id),
      }).read(null);

      expect(lecture.byOperator[0]).toEqual({
        operator: { id: 'nadia', firstName: 'Nadia', lastName: 'Berthier' },
        openCases: 0,
        closedInPeriod: 9,
        medianClosureDays: null,
      });
    });

    it('rend un délai médian à partir de dix clôtures', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: dossiersClos(10, NADIA.id),
      }).read(null);

      expect(lecture.byOperator[0].closedInPeriod).toBe(10);
      expect(lecture.byOperator[0].medianClosureDays).toBe(44.5);
    });

    it('donne sa ligne à un compte désactivé qui porte encore un dossier', async () => {
      const lecture = await build({
        users: [{ ...MARC, status: 'DISABLED' }],
        cases: [unDossier({ operatorUserId: MARC.id })],
      }).read(null);

      expect(lecture.byOperator[0]).toEqual({
        operator: { id: 'marc', firstName: 'Marc', lastName: 'Olivier' },
        openCases: 1,
        closedInPeriod: 0,
        medianClosureDays: null,
      });
    });

    it('range avec les orphelins un dossier dont le compte désigné a disparu', async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [
          unDossier({ id: 'case-1', operatorUserId: NADIA.id }),
          unDossier({ id: 'case-2', operatorUserId: 'compte-disparu' }),
        ],
      }).read(null);

      expect(lecture.cases.openCases[1].operator).toBeNull();
      expect(
        lecture.byOperator.reduce((total, ligne) => total + ligne.openCases, 0),
      ).toBe(lecture.cases.open);
      expect(lecture.byOperator[lecture.byOperator.length - 1].openCases).toBe(
        1,
      );
    });

    it("garde l'entrée sans opérateur même quand aucun dossier n'est orphelin", async () => {
      const lecture = await build({
        users: [NADIA],
        cases: [unDossier()],
      }).read(null);

      expect(lecture.byOperator[lecture.byOperator.length - 1]).toEqual({
        operator: null,
        openCases: 0,
        closedInPeriod: 0,
        medianClosureDays: null,
      });
    });

    it('trie par charge décroissante et somme exactement les dossiers en cours', async () => {
      const lecture = await build({
        users: [NADIA, MARC],
        cases: [
          unDossier({ id: 'case-1', operatorUserId: MARC.id }),
          unDossier({ id: 'case-2', operatorUserId: MARC.id }),
          unDossier({ id: 'case-3', operatorUserId: NADIA.id }),
          unDossier({ id: 'case-4', operatorUserId: null }),
        ],
      }).read(null);

      expect(
        lecture.byOperator.map((ligne) => [
          ligne.operator?.id ?? null,
          ligne.openCases,
        ]),
      ).toEqual([
        [MARC.id, 2],
        [NADIA.id, 1],
        [null, 1],
      ]);
      expect(
        lecture.byOperator.reduce((total, ligne) => total + ligne.openCases, 0),
      ).toBe(lecture.cases.open);
    });
  });

  describe('un service sans aucun dossier', () => {
    it('rend des zéros, une liste vide et des délais nuls', async () => {
      const lecture = await build().read(null);

      expect(lecture.cases).toMatchObject({
        open: 0,
        openOver90Days: 0,
        openedInPeriod: 0,
        closedInPeriod: 0,
        medianClosureDays: null,
        ninthDecileClosureDays: null,
        openCases: [],
      });
      expect(lecture.traces).toEqual({
        collected: 0,
        exploitable: 0,
        compared: 0,
        identified: 0,
      });
      expect(lecture.signals).toEqual({
        dormantOver30Days: 0,
        expertiseDeadlinesUnder15Days: 0,
        exploitableNeverCompared: 0,
        openWithoutOperator: 0,
      });
      expect(lecture.byOperator).toEqual([
        {
          operator: null,
          openCases: 0,
          closedInPeriod: 0,
          medianClosureDays: null,
        },
      ]);
    });
  });

  describe("l'existence d'un opérateur", () => {
    it('reconnaît un compte du service', async () => {
      expect(await build({ users: [NADIA] }).operatorExists(NADIA.id)).toBe(
        true,
      );
    });

    it("ne reconnaît pas un identifiant qui n'a pas de compte", async () => {
      expect(await build({ users: [NADIA] }).operatorExists('fantome')).toBe(
        false,
      );
    });
  });
});
