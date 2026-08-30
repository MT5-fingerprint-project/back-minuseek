import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { MINUTIA_SETTINGS_TYPES } from '../../../shared/domain/forensics/minutiae';
import type {
  CaseReportData,
  CaseReportDataReader,
  ExpertData,
  LayerData,
  LocationPhotoData,
  MinutiaData,
  PieceData,
  VerificationReportData,
  VerifierData,
} from '../../application/ports/case-report-data.reader';

interface PieceRow {
  id: string;
  path: string;
  sha256: string | null;
  displayableSha256?: string | null;
  createdAt: Date;
  capturedAt?: Date | null;
  status?: string | null;
  subjectId?: string | null;
  position?: string | null;
  withdrawnAt: Date | null;
  withdrawalMotive?: string | null;
  withdrawalMotiveDetail?: string | null;
  imageDestroyedAt?: Date | null;
  origin?: string | null;
  location?: string | null;
  revelationTechnique?: string | null;
  locationPhoto?: { path: string; sha256: string; createdAt: Date } | null;
}

interface LayerRow {
  fingerprintId: string;
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: unknown;
}

const MINUTIA_KINDS = new Set<string>(MINUTIA_SETTINGS_TYPES);

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function toMinutia(settings: Record<string, unknown>): MinutiaData | null {
  const kind = settings.type;
  const x = settings.x;
  const y = settings.y;
  if (typeof kind !== 'string' || !MINUTIA_KINDS.has(kind)) {
    return null;
  }
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }
  return {
    kind,
    x,
    y,
    radius: numberOrNull(settings.radius),
    angleDeg: numberOrNull(settings.angleDeg),
    color: typeof settings.color === 'string' ? settings.color : null,
    typeLabel: null,
  };
}

function toLocationPhoto(row: PieceRow): LocationPhotoData | null {
  if (!row.locationPhoto) {
    return null;
  }
  return {
    path: row.locationPhoto.path,
    sha256: row.locationPhoto.sha256,
    sealedAt: row.locationPhoto.createdAt,
  };
}

function toPiece(
  row: PieceRow,
  layers: LayerData[],
  minutiae: MinutiaData[],
  number: number | null = null,
): PieceData {
  return {
    id: row.id,
    path: row.path,
    sha256: row.sha256,
    displayableSha256: row.displayableSha256 ?? null,
    createdAt: row.createdAt,
    capturedAt: row.capturedAt ?? null,
    status: row.status ?? null,
    subjectId: row.subjectId ?? null,
    position: row.position ?? null,
    layers,
    minutiae,
    withdrawnAt: row.withdrawnAt,
    withdrawalMotive: row.withdrawalMotive ?? null,
    withdrawalMotiveDetail: row.withdrawalMotiveDetail ?? null,
    imageDestroyedAt: row.imageDestroyedAt ?? null,
    number,
    origin: row.origin ?? null,
    location: row.location ?? null,
    revelationTechnique: row.revelationTechnique ?? null,
    cote: null,
    notIdentifiedAt: null,
    locationPhoto: toLocationPhoto(row),
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

    const [traces, referencePrints, subjects] = await Promise.all([
      prisma.trace.findMany({
        where: { caseId },
        include: { locationPhoto: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.referencePrint.findMany({
        where: { caseId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.subject.findMany({
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
    const minutiaeByPiece = new Map<string, MinutiaData[]>();
    for (const layer of layers as LayerRow[]) {
      const settings = layer.settings as Record<string, unknown>;
      const pieceLayers = layersByPiece.get(layer.fingerprintId) ?? [];
      pieceLayers.push({
        name: layer.name,
        type: layer.type,
        zIndex: layer.zIndex,
        isVisible: layer.isVisible,
        settings,
      });
      layersByPiece.set(layer.fingerprintId, pieceLayers);

      const minutia = toMinutia(settings);
      if (minutia) {
        const pieceMinutiae = minutiaeByPiece.get(layer.fingerprintId) ?? [];
        pieceMinutiae.push(minutia);
        minutiaeByPiece.set(layer.fingerprintId, pieceMinutiae);
      }
    }

    const traceIds = traces.map((trace) => trace.id);
    const [matchings, hits] = await Promise.all([
      prisma.matching.findMany({
        where: { traceId: { in: traceIds } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.hit.findMany({
        where: { traceId: { in: traceIds } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const expertise = await prisma.caseExpertise.findUnique({
      where: { caseId },
      include: {
        assistants: {
          select: { name: true, task: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    const experts = await this.readExperts(
      prisma,
      [
        ...hits.map((hit) => hit.declaredByUserId),
        expertise?.expertUserId ?? null,
      ].filter((userId): userId is string => userId !== null),
    );
    const declaredPairs = new Set(
      hits.map((hit) => `${hit.traceId}:${hit.referencePrintId}`),
    );
    const verifications = await this.readVerifications(prisma, caseId);

    return {
      investigationCase: {
        id: investigationCase.id,
        caseNumber: investigationCase.caseNumber,
        pvNumber: investigationCase.pvNumber,
        description: investigationCase.description,
        status: investigationCase.status,
        createdAt: investigationCase.createdAt,
        // Colonnes judiciaires : L2-1a. Destinataire : L2-2.
        requestDate: null,
        requesterQuality: null,
        requesterName: null,
        requesterService: null,
        offenseNature: null,
        offenseLocation: null,
        offenseDateFrom: null,
        offenseDateTo: null,
        interventionDate: null,
        caseAgainst: null,
        recipient: {
          authority: null,
          attentionQuality: null,
          attentionName: null,
        },
      },
      expertise: expertise
        ? {
            expert: experts.get(expertise.expertUserId) ?? null,
            oathStatement: expertise.oathStatement,
            courtReference: expertise.courtReference,
            swornAt: expertise.swornAt,
            magistrateName: expertise.magistrateName,
            magistrateTitle: expertise.magistrateTitle,
            ordinanceDate: expertise.ordinanceDate,
            missionObject: expertise.missionObject,
            sealCount: expertise.sealCount,
            prorogationDeadline: expertise.prorogationDeadline,
            prorogationOrdinanceDate: expertise.prorogationOrdinanceDate,
            biologicalPrecautions: expertise.biologicalPrecautions,
            assistants: expertise.assistants,
          }
        : null,
      // Rang provisoire dans l'ordre de dépôt, celui que la migration de L4-1a
      // écrira en colonne : à remplacer par `trace.number` dès sa fusion.
      traces: traces.map((trace, order) =>
        toPiece(
          trace,
          layersByPiece.get(trace.id) ?? [],
          minutiaeByPiece.get(trace.id) ?? [],
          order + 1,
        ),
      ),
      referencePrints: referencePrints.map((print) =>
        toPiece(
          print,
          layersByPiece.get(print.id) ?? [],
          minutiaeByPiece.get(print.id) ?? [],
        ),
      ),
      comparisons: matchings.map((matching) => ({
        traceId: matching.traceId,
        referencePrintId: matching.referencePrintId,
        score: matching.score,
        machineMatch: matching.match,
        declaredHit: declaredPairs.has(
          `${matching.traceId}:${matching.referencePrintId}`,
        ),
        comparedAt: matching.createdAt,
      })),
      declaredHits: hits.map((hit) => ({
        traceId: hit.traceId,
        referencePrintId: hit.referencePrintId,
        declaredAt: hit.createdAt,
        declaredBy: hit.declaredByUserId
          ? (experts.get(hit.declaredByUserId) ?? null)
          : null,
        withdrawnAt: hit.withdrawnAt,
      })),
      minutiaPairs: [],
      verifications,
      subjects: subjects.map((subject) => ({
        id: subject.id,
        firstName: subject.firstName,
        lastName: subject.lastName,
        birthDate: subject.birthDate,
        birthPlace: subject.birthPlace,
        sex: subject.sex,
        type: subject.type,
      })),
    };
  }

  private async readVerifications(
    prisma: Awaited<ReturnType<TenantConnectionService['getCurrentClient']>>,
    caseId: string,
  ): Promise<VerificationReportData[]> {
    const missions = await prisma.caseVerification.findMany({
      where: { caseId },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
    });
    if (missions.length === 0) {
      return [];
    }

    const [verifiers, decisions] = await Promise.all([
      this.readVerifiers(
        prisma,
        missions.map((mission) => mission.verifierUserId),
      ),
      prisma.verificationDecision.findMany({
        where: {
          verificationId: { in: missions.map((mission) => mission.id) },
        },
        orderBy: [{ statedAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return missions.map((mission) => ({
      id: mission.id,
      verifier: verifiers.get(mission.verifierUserId) ?? null,
      status: mission.status,
      requestedAt: mission.requestedAt,
      completedAt: mission.completedAt,
      decisions: decisions
        .filter((decision) => decision.verificationId === mission.id)
        .map((decision) => ({
          traceId: decision.traceId,
          exploitability: decision.exploitability,
          identifiedReferencePrintId: decision.identifiedReferencePrintId,
          outcome: decision.outcome,
          statedAt: decision.statedAt,
        })),
    }));
  }

  private async readVerifiers(
    prisma: Awaited<ReturnType<TenantConnectionService['getCurrentClient']>>,
    userIds: string[],
  ): Promise<Map<string, VerifierData>> {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      include: { personalData: true },
    });
    return new Map(
      users.map((user) => [
        user.id,
        {
          identityProviderId: user.identityProviderId,
          firstName: user.personalData.firstName,
          lastName: user.personalData.lastName,
          grade: user.grade,
          serviceNumber: user.serviceNumber,
          role: user.role,
        },
      ]),
    );
  }

  private async readExperts(
    prisma: Awaited<ReturnType<TenantConnectionService['getCurrentClient']>>,
    userIds: string[],
  ): Promise<Map<string, ExpertData>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { personalData: true },
    });
    return new Map(
      users.map((user) => [
        user.id,
        {
          firstName: user.personalData.firstName,
          lastName: user.personalData.lastName,
          grade: user.grade,
          serviceNumber: user.serviceNumber,
          role: user.role,
        },
      ]),
    );
  }
}
