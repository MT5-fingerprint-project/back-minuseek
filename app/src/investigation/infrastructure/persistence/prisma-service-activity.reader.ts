import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { NOT_WITHDRAWN } from '../../../shared/infrastructure/persistence/withdrawal';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { percentile } from '../../application/queries/get-service-activity/percentile';
import type {
  MonthlyCaseFlowReadModel,
  OpenCaseReadModel,
  OperatorCaseloadReadModel,
  ServiceActivityReadModel,
  ServiceOperatorReadModel,
} from '../../application/queries/get-service-activity/service-activity-read-model';
import type { ServiceActivityReader } from '../../application/queries/get-service-activity/service-activity.reader';

const CLOSED = 'CLOSED';
const EXPLOITABLE = 'EXPLOITABLE';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// seuils arbitraires
const LONG_RUNNING_THRESHOLD_DAYS = 90;
const DORMANCY_THRESHOLD_DAYS = 30;
const DEADLINE_HORIZON_DAYS = 15;

const MIN_CLOSURES_FOR_MEDIAN = 10;

const PARIS_MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
});

interface OpenCaseRow {
  id: string;
  caseNumber: string;
  createdAt: Date;
  operatorUserId: string | null;
  lastActivityAt: Date | null;
}

interface ClosedCaseRow {
  id: string;
  createdAt: Date;
  operatorUserId: string | null;
  closedAt: Date;
}

interface OpenedCaseRow {
  createdAt: Date;
  operatorUserId: string | null;
}

@Injectable()
export class PrismaServiceActivityReader implements ServiceActivityReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async operatorExists(operatorUserId: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.user.findUnique({
      where: { id: operatorUserId },
      select: { id: true },
    });
    return found !== null;
  }

  async read(operatorUserId: string | null): Promise<ServiceActivityReadModel> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const now = new Date();
    const from = startOfParisYear(now);

    const operatorCaseIds =
      operatorUserId === null
        ? null
        : await this.caseIdsOf(prisma, operatorUserId);

    const [serviceOpenCases, serviceClosedCases, serviceOpenedCases] =
      await Promise.all([
        this.openCases(prisma),
        this.closedCases(prisma, from),
        this.casesOpenedSince(prisma, from),
      ]);

    const openCases = ownedBy(serviceOpenCases, operatorUserId);
    const closedCases = ownedBy(serviceClosedCases, operatorUserId);
    const openedCases = ownedBy(serviceOpenedCases, operatorUserId);

    const directory = await this.operatorDirectory(prisma, [
      ...serviceOpenCases,
      ...serviceClosedCases,
    ]);

    const [traces, exploitableNeverCompared, expertiseDeadlines] =
      await Promise.all([
        this.traceFunnel(prisma, from, operatorCaseIds),
        this.exploitableNeverCompared(prisma, operatorCaseIds),
        this.expertiseDeadlines(prisma, now, openCases),
      ]);

    const closureDurations = closedCases.map((row) =>
      elapsedDays(row.createdAt, row.closedAt),
    );

    return {
      period: { from, to: now },
      cases: {
        open: openCases.length,
        openOver90Days: openCases.filter(
          (row) =>
            elapsedDays(row.createdAt, now) > LONG_RUNNING_THRESHOLD_DAYS,
        ).length,
        openedInPeriod: openedCases.length,
        closedInPeriod: closedCases.length,
        medianClosureDays: percentile(closureDurations, 0.5),
        ninthDecileClosureDays: percentile(closureDurations, 0.9),
        monthlyFlow: monthlyFlow(now, openedCases, closedCases),
        openCases: openCasesReadModel(openCases, directory, now),
      },
      traces,
      signals: {
        dormantOver30Days: openCases.filter(
          (row) =>
            elapsedDays(row.lastActivityAt ?? row.createdAt, now) >
            DORMANCY_THRESHOLD_DAYS,
        ).length,
        expertiseDeadlinesUnder15Days: expertiseDeadlines,
        exploitableNeverCompared,
        openWithoutOperator: openCases.filter(
          (row) => row.operatorUserId === null,
        ).length,
      },
      byOperator: caseloadByOperator(
        serviceOpenCases,
        serviceClosedCases,
        directory,
      ),
    };
  }

  private async caseIdsOf(
    prisma: PrismaClient,
    operatorUserId: string,
  ): Promise<string[]> {
    const rows = await prisma.investigationCase.findMany({
      where: { operatorUserId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async openCases(prisma: PrismaClient): Promise<OpenCaseRow[]> {
    const rows = await prisma.investigationCase.findMany({
      where: { status: { not: CLOSED } },
      select: {
        id: true,
        caseNumber: true,
        createdAt: true,
        operatorUserId: true,
      },
    });
    if (rows.length === 0) return [];

    const lastActs = await prisma.auditEvent.groupBy({
      by: ['caseId'],
      where: { caseId: { in: rows.map((row) => row.id) } },
      _max: { occurredAt: true },
    });
    const lastActByCaseId = new Map(
      lastActs.map((group) => [group.caseId, group._max.occurredAt]),
    );

    return rows.map((row) => ({
      ...row,
      lastActivityAt: lastActByCaseId.get(row.id) ?? null,
    }));
  }

  private async closedCases(
    prisma: PrismaClient,
    from: Date,
  ): Promise<ClosedCaseRow[]> {
    const rows = await prisma.investigationCase.findMany({
      where: { status: CLOSED, closedAt: { gte: from } },
      select: {
        id: true,
        createdAt: true,
        operatorUserId: true,
        closedAt: true,
      },
    });

    return rows.flatMap((row) =>
      row.closedAt ? [{ ...row, closedAt: row.closedAt }] : [],
    );
  }

  private async casesOpenedSince(
    prisma: PrismaClient,
    from: Date,
  ): Promise<OpenedCaseRow[]> {
    return await prisma.investigationCase.findMany({
      where: { createdAt: { gte: from } },
      select: { createdAt: true, operatorUserId: true },
    });
  }

  private async operatorDirectory(
    prisma: PrismaClient,
    cases: { operatorUserId: string | null }[],
  ): Promise<Map<string, ServiceOperatorReadModel>> {
    const encountered = [
      ...new Set(
        cases
          .map((row) => row.operatorUserId)
          .filter((userId): userId is string => userId !== null),
      ),
    ];

    const accounts = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ['OPERATOR', 'ADMIN'] } },
          { id: { in: encountered } },
        ],
      },
      select: {
        id: true,
        personalData: { select: { firstName: true, lastName: true } },
      },
    });

    return new Map(
      accounts.map((account) => [
        account.id,
        {
          id: account.id,
          firstName: account.personalData.firstName,
          lastName: account.personalData.lastName,
        },
      ]),
    );
  }

  private async traceFunnel(
    prisma: PrismaClient,
    from: Date,
    operatorCaseIds: string[] | null,
  ): Promise<ServiceActivityReadModel['traces']> {
    const tracesOfPeriod = {
      ...tracesOf(operatorCaseIds),
      createdAt: { gte: from },
    };

    const [collected, exploitable, compared, identified] = await Promise.all([
      prisma.trace.count({ where: tracesOfPeriod }),
      prisma.trace.count({
        where: { ...tracesOfPeriod, status: EXPLOITABLE },
      }),
      prisma.matching.groupBy({
        by: ['traceId'],
        where: { trace: tracesOfPeriod },
      }),
      prisma.hit.groupBy({
        by: ['traceId'],
        where: { ...NOT_WITHDRAWN, trace: tracesOfPeriod },
      }),
    ]);

    return {
      collected,
      exploitable,
      compared: compared.length,
      identified: identified.length,
    };
  }

  private async exploitableNeverCompared(
    prisma: PrismaClient,
    operatorCaseIds: string[] | null,
  ): Promise<number> {
    const exploitable = await prisma.trace.findMany({
      where: { ...tracesOf(operatorCaseIds), status: EXPLOITABLE },
      select: { id: true },
    });
    if (exploitable.length === 0) return 0;

    const compared = await prisma.matching.groupBy({
      by: ['traceId'],
      where: { traceId: { in: exploitable.map((trace) => trace.id) } },
    });

    return exploitable.length - compared.length;
  }

  private async expertiseDeadlines(
    prisma: PrismaClient,
    now: Date,
    openCases: OpenCaseRow[],
  ): Promise<number> {
    if (openCases.length === 0) return 0;

    return await prisma.caseExpertise.count({
      where: {
        caseId: { in: openCases.map((row) => row.id) },
        prorogationDeadline: {
          not: null,
          lte: new Date(
            now.getTime() + DEADLINE_HORIZON_DAYS * MILLISECONDS_PER_DAY,
          ),
        },
      },
    });
  }
}

function tracesOf(operatorCaseIds: string[] | null) {
  return {
    ...NOT_WITHDRAWN,
    ...(operatorCaseIds === null ? {} : { caseId: { in: operatorCaseIds } }),
  };
}

function ownedBy<Row extends { operatorUserId: string | null }>(
  rows: Row[],
  operatorUserId: string | null,
): Row[] {
  if (operatorUserId === null) return rows;
  return rows.filter((row) => row.operatorUserId === operatorUserId);
}

function openCasesReadModel(
  rows: OpenCaseRow[],
  directory: Map<string, ServiceOperatorReadModel>,
  now: Date,
): OpenCaseReadModel[] {
  return [...rows]
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .map((row) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      openedAt: row.createdAt,
      ageInDays: elapsedDays(row.createdAt, now),
      operator:
        row.operatorUserId === null
          ? null
          : (directory.get(row.operatorUserId) ?? null),
      lastActivityAt: row.lastActivityAt,
    }));
}

function monthlyFlow(
  now: Date,
  openedCases: OpenedCaseRow[],
  closedCases: ClosedCaseRow[],
): MonthlyCaseFlowReadModel[] {
  const opened = countByMonth(openedCases.map((row) => row.createdAt));
  const closed = countByMonth(closedCases.map((row) => row.closedAt));

  const { year, month: lastMonth } = parisYearAndMonth(now);
  const flow: MonthlyCaseFlowReadModel[] = [];
  for (let month = 1; month <= lastMonth; month += 1) {
    const key = monthKey(year, month);
    flow.push({
      month: key,
      opened: opened.get(key) ?? 0,
      closed: closed.get(key) ?? 0,
    });
  }
  return flow;
}

function caseloadByOperator(
  openCases: OpenCaseRow[],
  closedCases: ClosedCaseRow[],
  directory: Map<string, ServiceOperatorReadModel>,
): OperatorCaseloadReadModel[] {
  const open = new Map<string, number>();
  let withoutOperator = 0;
  for (const row of openCases) {
    if (row.operatorUserId === null || !directory.has(row.operatorUserId)) {
      withoutOperator += 1;
      continue;
    }
    open.set(row.operatorUserId, (open.get(row.operatorUserId) ?? 0) + 1);
  }

  const closures = new Map<string, number[]>();
  for (const row of closedCases) {
    if (row.operatorUserId === null) continue;
    const durations = closures.get(row.operatorUserId) ?? [];
    durations.push(elapsedDays(row.createdAt, row.closedAt));
    closures.set(row.operatorUserId, durations);
  }

  const named = [...directory.values()].map((operator) => {
    const durations = closures.get(operator.id) ?? [];
    return {
      operator,
      openCases: open.get(operator.id) ?? 0,
      closedInPeriod: durations.length,
      medianClosureDays:
        durations.length >= MIN_CLOSURES_FOR_MEDIAN
          ? percentile(durations, 0.5)
          : null,
    };
  });

  named.sort(
    (left, right) =>
      right.openCases - left.openCases ||
      left.operator.lastName.localeCompare(right.operator.lastName) ||
      left.operator.firstName.localeCompare(right.operator.firstName) ||
      left.operator.id.localeCompare(right.operator.id),
  );

  return [
    ...named,
    {
      operator: null,
      openCases: withoutOperator,
      closedInPeriod: 0,
      medianClosureDays: null,
    },
  ];
}

function countByMonth(instants: Date[]): Map<string, number> {
  const counted = new Map<string, number>();
  for (const instant of instants) {
    const key = parisMonthKey(instant);
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }
  return counted;
}

function parisYearAndMonth(instant: Date): { year: number; month: number } {
  const parts = PARIS_MONTH_FORMAT.formatToParts(instant);
  const valueOf = (type: 'year' | 'month'): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: valueOf('year'), month: valueOf('month') };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parisMonthKey(instant: Date): string {
  const { year, month } = parisYearAndMonth(instant);
  return monthKey(year, month);
}

function startOfParisYear(instant: Date): Date {
  const { year } = parisYearAndMonth(instant);
  return new Date(Date.UTC(year, 0, 1) - 60 * 60 * 1000);
}

function elapsedDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
}
