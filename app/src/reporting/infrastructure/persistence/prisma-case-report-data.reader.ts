import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type {
  CaseReportData,
  CaseReportDataReader,
  LayerData,
  PieceData,
} from '../../application/ports/case-report-data.reader';

interface PieceRow {
  id: string;
  path: string;
  sha256: string | null;
  createdAt: Date;
  capturedAt?: Date | null;
  status?: string | null;
  score?: number | null;
}

function toPiece(row: PieceRow, layers: LayerData[]): PieceData {
  return {
    id: row.id,
    path: row.path,
    sha256: row.sha256,
    createdAt: row.createdAt,
    capturedAt: row.capturedAt ?? null,
    status: row.status ?? null,
    score: row.score ?? null,
    layers,
  };
}

@Injectable()
export class PrismaCaseReportDataReader implements CaseReportDataReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async read(caseId: string): Promise<CaseReportData | null> {
    const prisma = await this.tenantConnection.getCurrentClient();

    const investigationCase = await prisma.investigationCase.findUnique({
      where: { id: caseId },
    });
    if (!investigationCase) {
      return null;
    }

    const [traces, referencePrints] = await Promise.all([
      prisma.trace.findMany({
        where: { caseId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.referencePrint.findMany({
        where: { caseId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const pieceIds = [
      ...traces.map((trace) => trace.id),
      ...referencePrints.map((print) => print.id),
    ];
    const layers = await prisma.layer.findMany({
      where: { fingerprintId: { in: pieceIds } },
      orderBy: [{ zIndex: 'asc' }, { id: 'asc' }],
    });
    const layersByPiece = new Map<string, LayerData[]>();
    for (const layer of layers) {
      const pieceLayers = layersByPiece.get(layer.fingerprintId) ?? [];
      pieceLayers.push({
        name: layer.name,
        type: layer.type,
        zIndex: layer.zIndex,
        isVisible: layer.isVisible,
        settings: layer.settings as Record<string, unknown>,
      });
      layersByPiece.set(layer.fingerprintId, pieceLayers);
    }

    const traceIds = traces.map((trace) => trace.id);
    const [matchings, hits] = await Promise.all([
      prisma.matching.findMany({
        where: { traceId: { in: traceIds } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.hit.findMany({ where: { traceId: { in: traceIds } } }),
    ]);
    const declaredHits = new Set(
      hits.map((hit) => `${hit.traceId}:${hit.referencePrintId}`),
    );

    return {
      investigationCase: {
        id: investigationCase.id,
        caseNumber: investigationCase.caseNumber,
        pvNumber: investigationCase.pvNumber,
        description: investigationCase.description,
        status: investigationCase.status,
        createdAt: investigationCase.createdAt,
      },
      traces: traces.map((trace) =>
        toPiece(trace, layersByPiece.get(trace.id) ?? []),
      ),
      referencePrints: referencePrints.map((print) =>
        toPiece(print, layersByPiece.get(print.id) ?? []),
      ),
      comparisons: matchings.map((matching) => ({
        traceId: matching.traceId,
        referencePrintId: matching.referencePrintId,
        score: matching.score,
        machineMatch: matching.match,
        declaredHit: declaredHits.has(
          `${matching.traceId}:${matching.referencePrintId}`,
        ),
        comparedAt: matching.createdAt,
      })),
    };
  }
}
