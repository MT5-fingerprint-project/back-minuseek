export interface AuditEventData {
  seq: number;
  eventType: string;
  traceId: string | null;
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
  hashSpine: { seq: number; hash: string }[];
  anchors: AnchorData[];
}

export interface TraceabilityDataReader {
  read(caseId: string): Promise<TraceabilityData>;
  readCaseEvents(caseId: string): Promise<AuditEventData[]>;
  readAnchors(): Promise<AnchorData[]>;
}

export const TRACEABILITY_DATA_READER = 'TraceabilityDataReader';
