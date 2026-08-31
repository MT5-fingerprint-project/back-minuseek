import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  NOT_WITHDRAWN,
  WITHDRAWN_ONLY,
} from '../../../shared/infrastructure/persistence/withdrawal';
import { assignCotes } from '../../../shared/domain/forensics/cote';
import { traceReference } from '../../../shared/domain/forensics/trace-reference';
import { CaptureQualityProps } from '../../domain/trace/value-objects/capture-quality.vo';
import {
  TraceDetailReadModel,
  TraceReadModel,
} from '../../application/queries/list-traces/trace-read-model';
import type { TraceReader } from '../../application/queries/list-traces/trace.reader';

@Injectable()
export class PrismaTraceReader implements TraceReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(
    caseId: string,
    withdrawn = false,
  ): Promise<TraceReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const investigationCase = await prisma.investigationCase.findUnique({
      where: { id: caseId },
      select: { caseNumber: true },
    });
    if (!investigationCase) {
      return [];
    }
    const rows = await prisma.trace.findMany({
      where: { caseId, ...(withdrawn ? WITHDRAWN_ONLY : NOT_WITHDRAWN) },
      orderBy: { number: 'asc' },
      include: {
        hits: {
          where: { ...NOT_WITHDRAWN, referencePrint: NOT_WITHDRAWN },
          select: { id: true },
          take: 1,
        },
        // Un booléen, pas une adresse : signer une vignette que la liste
        // n'affiche pas coûterait un appel IAM par trace.
        locationPhoto: { select: { id: true } },
      },
    });
    const cotes = await this.cotesOf(prisma, caseId);
    return rows.map(({ hits, locationPhoto, ...row }) => ({
      ...row,
      captureQuality: row.captureQuality as CaptureQualityProps | null,
      reference: traceReference(investigationCase.caseNumber, row.number),
      cote: cotes.get(row.number) ?? null,
      identified: hits.length > 0,
      hasLocationPhoto: locationPhoto !== null,
    }));
  }

  async findById(id: string): Promise<TraceDetailReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.trace.findUnique({
      where: { id },
      include: {
        hits: {
          where: { ...NOT_WITHDRAWN, referencePrint: NOT_WITHDRAWN },
          select: { id: true },
          take: 1,
        },
        locationPhoto: true,
      },
    });
    if (!row) {
      return null;
    }
    const investigationCase = await prisma.investigationCase.findUnique({
      where: { id: row.caseId },
      select: { caseNumber: true },
    });
    if (!investigationCase) {
      return null;
    }
    const { hits, locationPhoto, ...trace } = row;
    const cotes = await this.cotesOf(prisma, trace.caseId);
    return {
      ...trace,
      captureQuality: trace.captureQuality as CaptureQualityProps | null,
      reference: traceReference(investigationCase.caseNumber, trace.number),
      cote: cotes.get(trace.number) ?? null,
      identified: hits.length > 0,
      hasLocationPhoto: locationPhoto !== null,
      locationPhoto:
        locationPhoto === null
          ? null
          : {
              id: locationPhoto.id,
              path: locationPhoto.path,
              sha256: locationPhoto.sha256,
              sealedAt: locationPhoto.createdAt,
            },
    };
  }

  // La cote d'une trace ne se lit jamais seule : elle dépend du statut et du
  // numéro de ses voisines, y compris celles que la liste demandée écarte.
  private async cotesOf(
    prisma: PrismaClient,
    caseId: string,
  ): Promise<Map<number, string>> {
    const siblings = await prisma.trace.findMany({
      where: { caseId, ...NOT_WITHDRAWN },
      select: { number: true, status: true },
    });
    return assignCotes(siblings);
  }
}
