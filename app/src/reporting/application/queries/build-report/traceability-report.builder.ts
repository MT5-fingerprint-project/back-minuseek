import { ChainAttestation } from '../../ports/chain-attestation.port';
import { TraceabilityData } from '../../ports/traceability-data.reader';
import { TraceabilityReportViewModel } from '../../report-view-model';

export interface TraceabilityReportInput {
  caseNumber: string;
  pvNumber: string;
  caseStatus: string;
  openedAt: Date;
  reportId: string;
  chainHead: { seq: number; hash: string } | null;
  generatedAt: Date;
  generatedByDisplayName: string;
  data: TraceabilityData;
  attestation: ChainAttestation;
}

export function buildTraceabilityReport(
  input: TraceabilityReportInput,
): TraceabilityReportViewModel {
  return {
    kind: 'TRACEABILITY',
    header: {
      reportId: input.reportId,
      chainHeadSeq: input.chainHead?.seq ?? null,
      chainHeadHash: input.chainHead?.hash ?? null,
      caseNumber: input.caseNumber,
      pvNumber: input.pvNumber,
      caseStatus: input.caseStatus,
      openedAt: input.openedAt,
      generatedAt: input.generatedAt,
      generatedByDisplayName: input.generatedByDisplayName,
    },
    events: input.data.caseEvents.map((event) => ({
      seq: event.seq,
      eventType: event.eventType,
      evidenceClass: event.evidenceClass,
      actorDisplayName: event.actorDisplayName,
      occurredAt: event.occurredAt,
      payload: event.payload,
      hash: event.hash,
      prevHash: event.prevHash,
    })),
    hashSpine: input.data.hashSpine,
    anchors: input.data.anchors,
    attestation: input.attestation,
  };
}
