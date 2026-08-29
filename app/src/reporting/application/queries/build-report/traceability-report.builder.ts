import { ChainAttestation } from '../../ports/chain-attestation.port';
import { ServiceLetterheadData } from '../../ports/service-letterhead.reader';
import { TraceabilityData } from '../../ports/traceability-data.reader';
import { buildLetterhead, signatureCityOf } from './letterhead';
import { TraceabilityReportViewModel } from '../../report-view-model';

export interface TraceabilityReportInput {
  caseNumber: string;
  pvNumber: string;
  caseStatus: string;
  openedAt: Date;
  reportId: string;
  reportNumber: string;
  chainHead: { seq: number; hash: string } | null;
  generatedAt: Date;
  generatedByDisplayName: string;
  data: TraceabilityData;
  attestation: ChainAttestation;
  letterhead: ServiceLetterheadData;
}

export function buildTraceabilityReport(
  input: TraceabilityReportInput,
): TraceabilityReportViewModel {
  return {
    kind: 'TRACEABILITY',
    header: {
      reportId: input.reportId,
      reportNumber: input.reportNumber,
      chainHeadSeq: input.chainHead?.seq ?? null,
      chainHeadHash: input.chainHead?.hash ?? null,
      caseNumber: input.caseNumber,
      pvNumber: input.pvNumber,
      caseStatus: input.caseStatus,
      openedAt: input.openedAt,
      generatedAt: input.generatedAt,
      generatedByDisplayName: input.generatedByDisplayName,
      letterhead: buildLetterhead(input.letterhead),
      signatureCity: signatureCityOf(input.letterhead),
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
