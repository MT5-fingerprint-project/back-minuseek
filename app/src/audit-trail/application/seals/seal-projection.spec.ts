import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { AnchorPoint, SealingEvent, sealsFromEvents } from './seal-projection';

const AT = new Date('2026-03-16T17:03:00.000Z');
const DIGEST = 'a'.repeat(64);

function event(
  eventType: AuditEventTypeEnum,
  payload: Record<string, unknown>,
  seq = 5n,
): SealingEvent {
  return { seq, eventType, occurredAt: AT, caseId: 'case-1', payload };
}

function anchor(headSeq: bigint, anchoredAt: Date): AnchorPoint {
  return { headSeq, anchoredAt };
}

describe('sealsFromEvents', () => {
  it('projette le dépôt d’une trace', () => {
    expect(
      sealsFromEvents(
        [
          event(AuditEventTypeEnum.TRACE_UPLOADED, {
            fileSha256: DIGEST,
            storagePath: 'media/case-1/traces/t1.png',
          }),
        ],
        [],
      ),
    ).toEqual([
      {
        sha256: DIGEST,
        kind: 'TRACE',
        chainSeq: 5n,
        sealedAt: AT,
        caseId: 'case-1',
        reportType: null,
        anchoredAt: null,
      },
    ]);
  });

  it('projette le dépôt d’une empreinte de référence', () => {
    const [seal] = sealsFromEvents(
      [
        event(AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED, {
          referencePrintId: 'ref-1',
          fileSha256: DIGEST,
        }),
      ],
      [],
    );

    expect(seal.kind).toBe('REFERENCE_PRINT');
  });

  it('projette l’édition d’un rapport avec la nature du document', () => {
    const [seal] = sealsFromEvents(
      [
        event(AuditEventTypeEnum.REPORT_GENERATED, {
          reportId: 'report-1',
          type: 'TECHNICAL',
          sha256: DIGEST,
        }),
      ],
      [],
    );

    expect(seal).toMatchObject({ kind: 'REPORT', reportType: 'TECHNICAL' });
  });

  it('ne donne de nature qu’aux rapports, même si un autre acte porte un `type`', () => {
    const [seal] = sealsFromEvents(
      [
        event(AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: DIGEST,
          type: 'image/png',
        }),
      ],
      [],
    );

    expect(seal.kind).toBe('TRACE');
    expect(seal.reportType).toBeNull();
  });

  it('ne projette pas le retrait d’une pièce, qui porte pourtant son empreinte', () => {
    expect(
      sealsFromEvents(
        [
          event(AuditEventTypeEnum.TRACE_DELETED, {
            traceId: 'trace-1',
            storagePath: 'media/case-1/traces/trace-1.png',
            fileSha256: DIGEST,
            motive: 'MISFILED',
          }),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it('ignore un acte qui ne scelle aucun fichier', () => {
    expect(
      sealsFromEvents(
        [event(AuditEventTypeEnum.CASE_OPENED, { caseNumber: '3455' })],
        [],
      ),
    ).toEqual([]);
  });

  it('ignore un acte scellant dont l’empreinte n’en est pas une', () => {
    expect(
      sealsFromEvents(
        [
          event(AuditEventTypeEnum.TRACE_UPLOADED, {
            fileSha256: 'pas-un-hash',
          }),
          event(AuditEventTypeEnum.TRACE_UPLOADED, {}),
          event(AuditEventTypeEnum.TRACE_UPLOADED, {
            fileSha256: 'A'.repeat(64),
          }),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it('date le scellé de la première ancre qui le couvre, pas de la dernière', () => {
    const [seal] = sealsFromEvents(
      [event(AuditEventTypeEnum.TRACE_UPLOADED, { fileSha256: DIGEST }, 30n)],
      [
        anchor(90n, new Date('2026-03-18T02:00:00.000Z')),
        anchor(40n, new Date('2026-03-17T02:00:00.000Z')),
        anchor(10n, new Date('2026-03-16T10:00:00.000Z')),
      ],
    );

    expect(seal.anchoredAt).toEqual(new Date('2026-03-17T02:00:00.000Z'));
  });

  it('laisse un scellé sans date d’ancrage quand aucune ancre ne le couvre', () => {
    const [seal] = sealsFromEvents(
      [event(AuditEventTypeEnum.TRACE_UPLOADED, { fileSha256: DIGEST }, 30n)],
      [anchor(10n, new Date('2026-03-16T10:00:00.000Z'))],
    );

    expect(seal.anchoredAt).toBeNull();
  });

  it('accepte une ancre posée exactement sur l’inscription', () => {
    const [seal] = sealsFromEvents(
      [event(AuditEventTypeEnum.TRACE_UPLOADED, { fileSha256: DIGEST }, 30n)],
      [anchor(30n, new Date('2026-03-17T02:00:00.000Z'))],
    );

    expect(seal.anchoredAt).toEqual(new Date('2026-03-17T02:00:00.000Z'));
  });

  it('ne rattache aucun dossier à un acte qui n’en porte pas', () => {
    const [seal] = sealsFromEvents(
      [
        {
          ...event(AuditEventTypeEnum.REPORT_GENERATED, {
            type: 'TECHNICAL',
            sha256: DIGEST,
          }),
          caseId: null,
        },
      ],
      [],
    );

    expect(seal.caseId).toBeNull();
  });
});
