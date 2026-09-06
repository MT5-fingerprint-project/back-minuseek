import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import type {
  SealKind,
  SealToRecord,
} from '../../../shared/domain/ports/seal-registry.port';

export interface SealingEvent {
  seq: bigint;
  eventType: string;
  occurredAt: Date;
  caseId: string | null;
  payload: Record<string, unknown>;
}

export interface AnchorPoint {
  headSeq: bigint;
  anchoredAt: Date;
}

export type ProjectedSeal = SealToRecord & { anchoredAt: Date | null };

export const SEALING_EVENTS: Record<
  string,
  { kind: SealKind; digestKey: string }
> = {
  [AuditEventTypeEnum.TRACE_UPLOADED]: {
    kind: 'TRACE',
    digestKey: 'fileSha256',
  },
  [AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED]: {
    kind: 'REFERENCE_PRINT',
    digestKey: 'fileSha256',
  },
  [AuditEventTypeEnum.REPORT_GENERATED]: {
    kind: 'REPORT',
    digestKey: 'sha256',
  },
  [AuditEventTypeEnum.EXPORTED_IMAGE_DEPOSITED]: {
    kind: 'EXPORTED_IMAGE',
    digestKey: 'fileSha256',
  },
  [AuditEventTypeEnum.CONCORDANCE_VIDEO_DEPOSITED]: {
    kind: 'CONCORDANCE_VIDEO',
    digestKey: 'fileSha256',
  },
};

const SHA256_HEX = /^[0-9a-f]{64}$/;

function anchoredAtOf(seq: bigint, anchors: AnchorPoint[]): Date | null {
  return anchors.find((anchor) => anchor.headSeq >= seq)?.anchoredAt ?? null;
}

export function sealsFromEvents(
  events: SealingEvent[],
  anchors: AnchorPoint[],
): ProjectedSeal[] {
  const ordered = [...anchors].sort((left, right) =>
    left.headSeq < right.headSeq ? -1 : left.headSeq > right.headSeq ? 1 : 0,
  );

  return events.flatMap((event) => {
    const sealing = SEALING_EVENTS[event.eventType];
    if (!sealing) {
      return [];
    }
    const digest = event.payload[sealing.digestKey];
    if (typeof digest !== 'string' || !SHA256_HEX.test(digest)) {
      return [];
    }
    const reportType = event.payload.type;
    return [
      {
        sha256: digest,
        kind: sealing.kind,
        chainSeq: event.seq,
        sealedAt: event.occurredAt,
        caseId: event.caseId,
        reportType:
          sealing.kind === 'REPORT' && typeof reportType === 'string'
            ? reportType
            : null,
        anchoredAt: anchoredAtOf(event.seq, ordered),
      },
    ];
  });
}
