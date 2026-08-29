import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { AuditEventData } from '../../ports/traceability-data.reader';
import {
  buildJournalAnnex,
  journalRows,
  PRINTABLE_EVENT_TYPES,
} from './journal-annex.builder';
import { PieceDesignation } from './piece-designations';

const NAMED: Map<string, PieceDesignation> = new Map([
  [
    'trace-2',
    { full: 'la trace 3455-T2 cotée « B »', bare: 'la trace 3455-T2' },
  ],
  [
    'trace-3',
    { full: 'la trace 3455-T3 cotée « C »', bare: 'la trace 3455-T3' },
  ],
]);

let nextSeq = 0;

function at(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 2, 16, hour, minute, 0));
}

function event(
  eventType: AuditEventTypeEnum,
  occurredAt: Date,
  payload: Record<string, unknown> = {},
): AuditEventData {
  nextSeq += 1;
  return {
    seq: nextSeq,
    eventType,
    traceId: null,
    evidenceClass: 'OBSERVED',
    actorDisplayName: 'Sébastien Aguilar',
    occurredAt,
    payload,
    hash: 'a'.repeat(64),
    prevHash: 'b'.repeat(64),
  };
}

function filterLayer(
  eventType: AuditEventTypeEnum,
  occurredAt: Date,
  fingerprintId = 'trace-2',
): AuditEventData {
  return event(eventType, occurredAt, {
    layerId: 'layer-1',
    fingerprintId,
    name: 'Luminosité',
    type: 'FILTER',
    zIndex: 1,
    isVisible: true,
    settings: { filterKey: 'brightness', value: 20 },
  });
}

function minutiaLayer(
  occurredAt: Date,
  fingerprintId = 'trace-2',
): AuditEventData {
  return event(AuditEventTypeEnum.LAYER_CREATED, occurredAt, {
    layerId: 'layer-2',
    fingerprintId,
    name: 'Minutie',
    type: 'ANNOTATION',
    zIndex: 2,
    isVisible: true,
    settings: { type: 'minutiae', x: 10, y: 20 },
  });
}

beforeEach(() => {
  nextSeq = 0;
});

describe('PRINTABLE_EVENT_TYPES', () => {
  it('écarte les saisies administratives', () => {
    expect(PRINTABLE_EVENT_TYPES.has(AuditEventTypeEnum.CASE_UPDATED)).toBe(
      false,
    );
    expect(
      PRINTABLE_EVENT_TYPES.has(AuditEventTypeEnum.SERVICE_HEADER_SAVED),
    ).toBe(false);
  });

  it('imprime tout le reste du catalogue', () => {
    const printable = Object.values(AuditEventTypeEnum).filter((eventType) =>
      PRINTABLE_EVENT_TYPES.has(eventType),
    );

    expect(printable).toHaveLength(
      Object.values(AuditEventTypeEnum).length - 2,
    );
  });
});

describe('buildJournalAnnex — la variante résumée', () => {
  it('absorbe quinze réglages d’une même trace en une seule ligne', () => {
    const events = Array.from({ length: 15 }, (_unused, index) =>
      filterLayer(AuditEventTypeEnum.LAYER_UPDATED, at(17, 3 + index)),
    );

    const journal = buildJournalAnnex(events, NAMED, 'SUMMARY');

    expect(journal.acts).toEqual([]);
    expect(journal.summaries).toEqual([
      {
        family: 'ADJUSTMENT',
        pieceDesignation: 'la trace 3455-T2 cotée « B »',
        count: 15,
        firstAt: at(17, 3),
        lastAt: at(17, 17),
      },
    ]);
  });

  it('sépare les réglages des minuties, et les traces entre elles', () => {
    const journal = buildJournalAnnex(
      [
        filterLayer(AuditEventTypeEnum.LAYER_CREATED, at(17, 3)),
        minutiaLayer(at(17, 12)),
        filterLayer(AuditEventTypeEnum.LAYER_CREATED, at(17, 20), 'trace-3'),
      ],
      NAMED,
      'SUMMARY',
    );

    expect(
      journal.summaries.map((one) => [one.family, one.pieceDesignation]),
    ).toEqual([
      ['ADJUSTMENT', 'la trace 3455-T2 cotée « B »'],
      ['MARK', 'la trace 3455-T2 cotée « B »'],
      ['ADJUSTMENT', 'la trace 3455-T3 cotée « C »'],
    ]);
  });

  it('n’absorbe jamais un acte de fond', () => {
    const journal = buildJournalAnnex(
      [
        event(AuditEventTypeEnum.TRACE_UPLOADED, at(16, 0)),
        filterLayer(AuditEventTypeEnum.LAYER_CREATED, at(17, 3)),
        event(AuditEventTypeEnum.HIT_RECORDED, at(18, 0)),
      ],
      NAMED,
      'SUMMARY',
    );

    expect(journal.acts).toHaveLength(2);
    expect(journal.summaries).toHaveLength(1);
  });
});

describe('buildJournalAnnex — la variante détaillée', () => {
  it('énumère les quinze réglages, un par un', () => {
    const events = Array.from({ length: 15 }, (_unused, index) =>
      filterLayer(AuditEventTypeEnum.LAYER_UPDATED, at(17, 3 + index)),
    );

    const journal = buildJournalAnnex(events, NAMED, 'FULL');

    expect(journal.acts).toHaveLength(15);
    expect(journal.summaries).toEqual([]);
    expect(journal.acts[0].sentence).toBe(
      'Luminosité portée à +20 % sur la trace 3455-T2 cotée « B »',
    );
  });

  it('compte le même total que la variante résumée', () => {
    const events = Array.from({ length: 15 }, (_unused, index) =>
      filterLayer(AuditEventTypeEnum.LAYER_UPDATED, at(17, 3 + index)),
    );

    expect(buildJournalAnnex(events, NAMED, 'FULL').actCountTotal).toBe(
      buildJournalAnnex(events, NAMED, 'SUMMARY').actCountTotal,
    );
  });
});

describe('buildJournalAnnex — les deux compteurs', () => {
  it('compte toutes les inscriptions, et à côté les lignes affichées', () => {
    const events = [
      event(AuditEventTypeEnum.CASE_UPDATED, at(9, 0), { changes: {} }),
      event(AuditEventTypeEnum.CASE_UPDATED, at(9, 1), { changes: {} }),
      event(AuditEventTypeEnum.CASE_UPDATED, at(9, 2), { changes: {} }),
      event(AuditEventTypeEnum.TRACE_UPLOADED, at(10, 0)),
      event(AuditEventTypeEnum.TRACE_UPLOADED, at(10, 1)),
    ];

    for (const detail of ['SUMMARY', 'FULL'] as const) {
      const journal = buildJournalAnnex(events, NAMED, detail);

      expect(journal.actCountTotal).toBe(5);
      expect(journal.actCountPrinted).toBe(2);
    }
  });

  it('compte une synthèse pour une ligne, pas pour ce qu’elle absorbe', () => {
    const events = Array.from({ length: 15 }, (_unused, index) =>
      filterLayer(AuditEventTypeEnum.LAYER_UPDATED, at(17, 3 + index)),
    );

    const journal = buildJournalAnnex(events, NAMED, 'SUMMARY');

    expect(journal.actCountTotal).toBe(15);
    expect(journal.actCountPrinted).toBe(1);
  });
});

describe('journalRows', () => {
  it('intercale la synthèse au rang de son dernier acte absorbé', () => {
    const journal = buildJournalAnnex(
      [
        event(AuditEventTypeEnum.TRACE_UPLOADED, at(16, 0)),
        filterLayer(AuditEventTypeEnum.LAYER_CREATED, at(17, 3)),
        filterLayer(AuditEventTypeEnum.LAYER_UPDATED, at(17, 41)),
        event(AuditEventTypeEnum.HIT_RECORDED, at(18, 0)),
      ],
      NAMED,
      'SUMMARY',
    );

    expect(journalRows(journal).map((row) => row.kind)).toEqual([
      'act',
      'summary',
      'act',
    ]);
  });

  it('suit la chronologie en variante détaillée', () => {
    const journal = buildJournalAnnex(
      [
        event(AuditEventTypeEnum.TRACE_UPLOADED, at(16, 0)),
        filterLayer(AuditEventTypeEnum.LAYER_CREATED, at(17, 3)),
      ],
      NAMED,
      'FULL',
    );

    expect(journalRows(journal).map((row) => row.at)).toEqual([
      at(16, 0),
      at(17, 3),
    ]);
  });
});
