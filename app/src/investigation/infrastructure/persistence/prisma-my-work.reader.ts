import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { NOT_WITHDRAWN } from '../../../shared/infrastructure/persistence/withdrawal';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { countByAgeBracket } from '../../application/queries/get-my-work/age-bracket';
import type {
  MyWorkCaseReadModel,
  MyWorkDiscordanceReadModel,
  MyWorkPendingTracesReadModel,
  MyWorkReadModel,
} from '../../application/queries/get-my-work/my-work-read-model';
import type { MyWorkReader } from '../../application/queries/get-my-work/my-work.reader';

const CLOSED = 'CLOSED';
const RECEIVED = 'RECEIVED';
const EXPLOITABLE = 'EXPLOITABLE';
const DISCORDANT = 'DISCORDANT';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const OLDEST_CASES_SHOWN = 5;

const PARIS_YEAR_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
});

interface OpenCaseRow {
  id: string;
  caseNumber: string;
  createdAt: Date;
}

@Injectable()
export class PrismaMyWorkReader implements MyWorkReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async read(operatorUserId: string): Promise<MyWorkReadModel> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const now = new Date();
    const from = startOfParisYear(now);

    const openCases = await this.openCasesOf(prisma, operatorUserId);
    // La production de l'année couvre TOUS mes dossiers, clos compris : une
    // trace identifiée dans un dossier qu'on a refermé reste du travail fait.
    const myCaseIds = await this.caseIdsOf(prisma, operatorUserId);

    const [production, discordances, pendingTraces] = await Promise.all([
      this.production(prisma, from, myCaseIds),
      this.discordances(prisma, openCases),
      this.pendingTraces(prisma, openCases),
    ]);

    return {
      period: { from, to: now },
      production,
      cases: {
        open: openCases.length,
        ageBrackets: countByAgeBracket(
          openCases.map((row) => elapsedDays(row.createdAt, now)),
        ),
        oldest: oldestCases(openCases, now),
      },
      discordances,
      pendingTraces,
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

  private async openCasesOf(
    prisma: PrismaClient,
    operatorUserId: string,
  ): Promise<OpenCaseRow[]> {
    return await prisma.investigationCase.findMany({
      where: { operatorUserId, status: { not: CLOSED } },
      select: { id: true, caseNumber: true, createdAt: true },
    });
  }

  private async production(
    prisma: PrismaClient,
    from: Date,
    myCaseIds: string[],
  ): Promise<MyWorkReadModel['production']> {
    if (myCaseIds.length === 0) {
      return { collected: 0, exploitable: 0, compared: 0, identified: 0 };
    }

    const tracesOfPeriod = {
      ...NOT_WITHDRAWN,
      caseId: { in: myCaseIds },
      createdAt: { gte: from },
    };

    const [collected, exploitable, compared, identified] = await Promise.all([
      prisma.trace.count({ where: tracesOfPeriod }),
      prisma.trace.count({ where: { ...tracesOfPeriod, status: EXPLOITABLE } }),
      prisma.matching.groupBy({
        by: ['traceId'],
        where: { trace: tracesOfPeriod },
      }),
      // Une trace n'est identifiée que si le rapprochement ET l'empreinte de
      // référence qu'il désigne sont toujours au dossier : c'est la définition
      // que l'opérateur lit déjà sur sa fiche de trace.
      prisma.hit.groupBy({
        by: ['traceId'],
        where: {
          ...NOT_WITHDRAWN,
          referencePrint: NOT_WITHDRAWN,
          trace: tracesOfPeriod,
        },
      }),
    ]);

    return {
      collected,
      exploitable,
      compared: compared.length,
      identified: identified.length,
    };
  }

  private async discordances(
    prisma: PrismaClient,
    openCases: OpenCaseRow[],
  ): Promise<MyWorkDiscordanceReadModel[]> {
    if (openCases.length === 0) return [];

    // CaseVerification ne porte aucune relation Prisma vers InvestigationCase :
    // la jointure se fait en deux temps, sur l'index @@index([caseId]).
    const caseNumberById = new Map(
      openCases.map((row) => [row.id, row.caseNumber]),
    );
    const rows = await prisma.caseVerification.findMany({
      where: { caseId: { in: [...caseNumberById.keys()] }, status: DISCORDANT },
      select: { caseId: true, completedAt: true },
    });

    return rows
      .map((row) => ({
        caseId: row.caseId,
        caseNumber: caseNumberById.get(row.caseId) ?? '',
        completedAt: row.completedAt,
      }))
      .sort(oldestReturnFirst);
  }

  private async pendingTraces(
    prisma: PrismaClient,
    openCases: OpenCaseRow[],
  ): Promise<MyWorkPendingTracesReadModel[]> {
    if (openCases.length === 0) return [];

    const openCaseIds = openCases.map((row) => row.id);
    const [exploitable, received] = await Promise.all([
      prisma.trace.findMany({
        where: {
          ...NOT_WITHDRAWN,
          caseId: { in: openCaseIds },
          status: EXPLOITABLE,
        },
        select: { id: true, caseId: true },
      }),
      prisma.trace.groupBy({
        by: ['caseId'],
        where: {
          ...NOT_WITHDRAWN,
          caseId: { in: openCaseIds },
          status: RECEIVED,
        },
        _count: { _all: true },
      }),
    ]);

    const comparedTraceIds = new Set(
      exploitable.length === 0
        ? []
        : (
            await prisma.matching.groupBy({
              by: ['traceId'],
              where: { traceId: { in: exploitable.map((trace) => trace.id) } },
            })
          ).map((group) => group.traceId),
    );

    const neverComparedByCaseId = new Map<string, number>();
    for (const trace of exploitable) {
      if (comparedTraceIds.has(trace.id)) continue;
      neverComparedByCaseId.set(
        trace.caseId,
        (neverComparedByCaseId.get(trace.caseId) ?? 0) + 1,
      );
    }

    const notQualifiedByCaseId = new Map(
      received.map((group) => [group.caseId, group._count._all]),
    );

    return openCases
      .map((row) => ({
        caseId: row.id,
        caseNumber: row.caseNumber,
        exploitableNeverCompared: neverComparedByCaseId.get(row.id) ?? 0,
        receivedNotQualified: notQualifiedByCaseId.get(row.id) ?? 0,
      }))
      .filter(
        (row) =>
          row.exploitableNeverCompared > 0 || row.receivedNotQualified > 0,
      )
      .sort(mostWaitingFirst);
  }
}

function oldestCases(rows: OpenCaseRow[], now: Date): MyWorkCaseReadModel[] {
  return [...rows]
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .slice(0, OLDEST_CASES_SHOWN)
    .map((row) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      openedAt: row.createdAt,
      ageInDays: elapsedDays(row.createdAt, now),
    }));
}

function oldestReturnFirst(
  left: MyWorkDiscordanceReadModel,
  right: MyWorkDiscordanceReadModel,
): number {
  const leftAt = left.completedAt?.getTime() ?? 0;
  const rightAt = right.completedAt?.getTime() ?? 0;
  return leftAt - rightAt || left.caseId.localeCompare(right.caseId);
}

function mostWaitingFirst(
  left: MyWorkPendingTracesReadModel,
  right: MyWorkPendingTracesReadModel,
): number {
  const leftTotal = left.exploitableNeverCompared + left.receivedNotQualified;
  const rightTotal =
    right.exploitableNeverCompared + right.receivedNotQualified;
  return rightTotal - leftTotal || left.caseId.localeCompare(right.caseId);
}

function startOfParisYear(instant: Date): Date {
  const year = Number(PARIS_YEAR_FORMAT.format(instant));
  return new Date(Date.UTC(year, 0, 1) - 60 * 60 * 1000);
}

function elapsedDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
}
