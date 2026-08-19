export interface AuditEventData {
  seq: number;
  eventType: string;
  evidenceClass: string;
  actorDisplayName: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string;
}

export interface AnchorData {
  headSeq: number;
  headHash: string;
  tsaUrl: string;
  anchoredAt: Date;
  tsrSha256: string;
}

export interface TraceabilityData {
  caseEvents: AuditEventData[];
  /** Genesis → tête, tous dossiers confondus : seq et hash seuls (ADR-0012). */
  hashSpine: { seq: number; hash: string }[];
  anchors: AnchorData[];
}

export interface TraceabilityDataReader {
  read(caseId: string): Promise<TraceabilityData>;
}

export const TRACEABILITY_DATA_READER = 'TraceabilityDataReader';
