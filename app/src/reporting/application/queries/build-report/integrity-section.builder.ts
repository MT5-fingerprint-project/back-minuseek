import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { PieceData } from '../../ports/case-report-data.reader';
import { ChainAttestation } from '../../ports/chain-attestation.port';
import {
  AnchorData,
  AuditEventData,
} from '../../ports/traceability-data.reader';
import {
  ReportIntegrityViewModel,
  ReportPieceIntegrityViewModel,
  ReportTreatmentViewModel,
} from '../../report-view-model';
import { filterSentence } from './filter-labels';
import { designationOf, PieceDesignation } from './piece-designations';

export interface IntegritySectionInput {
  traces: PieceData[];
  referencePrints: PieceData[];
  designations: Map<string, PieceDesignation>;
  events: AuditEventData[];
  anchors: AnchorData[];
  attestation: ChainAttestation;
  verificationUrl: string;
}

const LAYER_DELETED: string = AuditEventTypeEnum.LAYER_DELETED;

const DEPOSIT_TYPES = new Set<string>([
  AuditEventTypeEnum.TRACE_UPLOADED,
  AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED,
]);

function stringOf(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function depositOf(
  piece: PieceData,
  events: AuditEventData[],
): AuditEventData | null {
  return (
    events.find(
      (event) =>
        DEPOSIT_TYPES.has(event.eventType) &&
        stringOf(event.payload, 'storagePath') === piece.path,
    ) ?? null
  );
}

interface LayerTrack {
  lastApplied: AuditEventData | null;
  removedAt: Date | null;
  lastSeq: number;
}

function treatmentsOf(
  piece: PieceData,
  events: AuditEventData[],
): { treatments: ReportTreatmentViewModel[]; lastSeq: number | null } {
  const tracks = new Map<string, LayerTrack>();

  for (const event of events) {
    const { payload } = event;
    if (payload.type !== 'FILTER' || payload.fingerprintId !== piece.id) {
      continue;
    }
    const layerId = stringOf(payload, 'layerId');
    if (layerId === null) {
      continue;
    }
    const track = tracks.get(layerId) ?? {
      lastApplied: null,
      removedAt: null,
      lastSeq: event.seq,
    };
    track.lastSeq = event.seq;
    if (event.eventType === LAYER_DELETED) {
      track.removedAt = event.occurredAt;
    } else {
      track.lastApplied = event;
    }
    tracks.set(layerId, track);
  }

  const treatments: ReportTreatmentViewModel[] = [];
  let lastSeq: number | null = null;
  for (const track of tracks.values()) {
    lastSeq =
      lastSeq === null ? track.lastSeq : Math.max(lastSeq, track.lastSeq);
    const applied = track.lastApplied;
    if (applied === null) {
      continue;
    }
    const settings = (applied.payload.settings ?? {}) as Record<
      string,
      unknown
    >;
    treatments.push({
      sentence: filterSentence(settings.filterKey, settings.value, 'applied'),
      appliedAt: applied.occurredAt,
      actorDisplayName: applied.actorDisplayName,
      removedAt: track.removedAt,
      hiddenAtEdition: applied.payload.isVisible === false,
    });
  }

  return { treatments, lastSeq };
}

function coveringAnchorOf(
  anchors: AnchorData[],
  lastActEntryNumber: number | null,
): AnchorData | null {
  if (lastActEntryNumber === null) {
    return null;
  }
  return (
    [...anchors]
      .sort((left, right) => left.headSeq - right.headSeq)
      .find((anchor) => anchor.headSeq >= lastActEntryNumber) ?? null
  );
}

function pieceIntegrity(
  piece: PieceData,
  input: IntegritySectionInput,
): ReportPieceIntegrityViewModel {
  const deposit = depositOf(piece, input.events);
  const recordedSha256 =
    deposit === null ? null : stringOf(deposit.payload, 'fileSha256');
  const mimeType =
    deposit === null ? null : stringOf(deposit.payload, 'mimeType');
  const { treatments, lastSeq } = treatmentsOf(piece, input.events);

  const lastActEntryNumber =
    deposit === null && lastSeq === null
      ? null
      : Math.max(deposit?.seq ?? 0, lastSeq ?? 0);
  const covering = coveringAnchorOf(input.anchors, lastActEntryNumber);

  return {
    designation: designationOf(input.designations, piece.id).full,
    cote: piece.cote,
    recordedSha256,
    sealedAt: deposit?.occurredAt ?? null,
    recordEntryNumber: deposit?.seq ?? null,
    currentRowSha256: piece.sha256,
    divergesFromRecord:
      recordedSha256 !== null &&
      piece.sha256 !== null &&
      piece.sha256 !== recordedSha256,
    servedFileIsDerived:
      mimeType === 'image/tiff' && piece.path.endsWith('.png'),
    observedSha256: null,
    observedMatchesRecord: null,
    treatments,
    lastActEntryNumber,
    coveringAnchor:
      covering === null
        ? null
        : {
            anchoredAt: covering.anchoredAt,
            authority: covering.tsaUrl,
            entryNumber: covering.headSeq,
          },
  };
}

export function buildIntegritySection(
  input: IntegritySectionInput,
): ReportIntegrityViewModel {
  const anchors = [...input.anchors].sort(
    (left, right) => left.headSeq - right.headSeq,
  );
  const last = anchors[anchors.length - 1];

  return {
    traces: input.traces.map((trace) => pieceIntegrity(trace, input)),
    referencePrints: input.referencePrints.map((print) =>
      pieceIntegrity(print, input),
    ),
    lastAnchor: last
      ? { anchoredAt: last.anchoredAt, entryNumber: last.headSeq }
      : null,
    recordVerifiedAtEdition: input.attestation.ok,
    firstBrokenEntryNumber: input.attestation.firstBrokenSeq,
    anchorsFailed: input.attestation.anchorsFailed,
    verificationUrl: input.verificationUrl,
  };
}
