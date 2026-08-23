import { REQUIRED_MINUTIAE } from '../../../../shared/domain/forensics/minutiae';
import type { CaseReportData } from '../../ports/case-report-data.reader';
import type { AuditEventData } from '../../ports/traceability-data.reader';
import type { ReportImageViewModel } from '../../report-view-model';
import { buildTechnicalReport } from './technical-report.builder';

const OPENED_AT = new Date('2026-08-01T09:00:00.000Z');
const COMPARED_AT = new Date('2026-08-10T14:00:00.000Z');
const DECLARED_AT = new Date('2026-08-11T09:30:00.000Z');
const GENERATED_AT = new Date('2026-08-19T08:00:00.000Z');

const TRACE_PATH = 'media/investigation-case/case-1/traces/trace-1.png';
const REF_PATH = 'media/investigation-case/case-1/reference-prints/ref-1.png';

function minutiae(count: number) {
  return Array.from({ length: count }, (_unused, index) => ({
    kind: 'minutiae',
    x: 100 + index * 10,
    y: 200 + index * 5,
    radius: 6,
    angleDeg: index * 15,
    color: '#d92b2b',
  }));
}

const DATA: CaseReportData = {
  investigationCase: {
    id: 'case-1',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2026-001',
    description: null,
    status: 'OPEN',
    createdAt: OPENED_AT,
  },
  traces: [
    {
      id: 'trace-1',
      path: TRACE_PATH,
      sha256: 'a'.repeat(64),
      createdAt: OPENED_AT,
      capturedAt: null,
      status: 'EXPLOITABLE',
      score: 72,
      subjectId: null,
      position: null,
      layers: [
        {
          name: 'Contraste',
          type: 'FILTER',
          zIndex: 1,
          isVisible: true,
          settings: { contrast: 1.4 },
        },
      ],
      minutiae: minutiae(13),
    },
  ],
  referencePrints: [
    {
      id: 'ref-1',
      path: REF_PATH,
      sha256: 'b'.repeat(64),
      createdAt: OPENED_AT,
      capturedAt: null,
      status: null,
      score: null,
      subjectId: 'subject-1',
      position: 'RIGHT_INDEX',
      layers: [],
      minutiae: minutiae(12),
    },
  ],
  comparisons: [
    {
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      score: 88.5,
      machineMatch: true,
      declaredHit: true,
      comparedAt: COMPARED_AT,
    },
  ],
  declaredHits: [
    {
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      declaredAt: DECLARED_AT,
      declaredBy: {
        firstName: 'Alex',
        lastName: 'Martin',
        grade: 'Brigadier',
        serviceNumber: 'PN-4412',
        role: 'EXPERT',
      },
    },
  ],
  subjects: [
    {
      id: 'subject-1',
      firstName: 'Camille',
      lastName: 'Durand',
      birthDate: new Date('1990-04-12T00:00:00.000Z'),
      birthPlace: 'Lyon',
      sex: 'FEMALE',
      type: 'PERSON_OF_INTEREST',
    },
  ],
};

const CHAIN_EVENTS: AuditEventData[] = [
  {
    seq: 4,
    eventType: 'CASE_OPENED',
    evidenceClass: 'OBSERVED',
    actorDisplayName: 'Alex Martin',
    occurredAt: OPENED_AT,
    payload: { caseNumber: 'AFF-001', pvNumber: 'PV-2026-001' },
    hash: 'c'.repeat(64),
    prevHash: 'd'.repeat(64),
  },
  {
    seq: 2,
    eventType: 'TRACE_UPLOADED',
    evidenceClass: 'OBSERVED',
    actorDisplayName: 'Alex Martin',
    occurredAt: OPENED_AT,
    payload: { traceId: 'trace-1', sha256: 'a'.repeat(64) },
    hash: 'e'.repeat(64),
    prevHash: 'f'.repeat(64),
  },
];

const IMAGES = new Map<string, ReportImageViewModel | null>([
  [
    TRACE_PATH,
    { dataUrl: 'data:image/png;base64,AAA', width: 800, height: 1200 },
  ],
  [REF_PATH, { dataUrl: 'data:image/png;base64,BBB', width: 500, height: 700 }],
]);

function build(
  overrides: Partial<Parameters<typeof buildTechnicalReport>[0]> = {},
) {
  return buildTechnicalReport({
    data: DATA,
    chainEvents: CHAIN_EVENTS,
    reportId: 'report-1',
    chainHead: { seq: 42, hash: 'b'.repeat(64) },
    generatedAt: GENERATED_AT,
    generatedByDisplayName: 'Alex Martin',
    images: IMAGES,
    ...overrides,
  });
}

describe("buildTechnicalReport — démonstration d'identité", () => {
  it('compose une planche par correspondance déclarée', () => {
    const model = build();

    expect(model.identityDemonstrations).toHaveLength(1);
    const [demonstration] = model.identityDemonstrations;
    expect(demonstration.trace.label).toBe('trace-1.png');
    expect(demonstration.referencePrint.label).toBe('ref-1.png');
    expect(demonstration.score).toBe(88.5);
    expect(demonstration.machineMatch).toBe(true);
    expect(demonstration.comparedAt).toEqual(COMPARED_AT);
    expect(demonstration.declaredAt).toEqual(DECLARED_AT);
    expect(demonstration.requiredMinutiae).toBe(REQUIRED_MINUTIAE);
  });

  it('nomme le sujet et la zone attribuée', () => {
    const [demonstration] = build().identityDemonstrations;

    expect(demonstration.subject).toEqual({
      firstName: 'Camille',
      lastName: 'Durand',
      birthDate: new Date('1990-04-12T00:00:00.000Z'),
      birthPlace: 'Lyon',
      sex: 'FEMALE',
      type: 'PERSON_OF_INTEREST',
    });
    expect(demonstration.position).toBe('index droit');
  });

  it("identifie l'expert qui a déclaré la correspondance", () => {
    const [demonstration] = build().identityDemonstrations;

    expect(demonstration.declaredBy).toEqual({
      displayName: 'Alex Martin',
      grade: 'Brigadier',
      serviceNumber: 'PN-4412',
      role: 'EXPERT',
    });
  });

  it('numérote les minuties de chaque pièce et garde leurs coordonnées', () => {
    const [demonstration] = build().identityDemonstrations;

    expect(demonstration.trace.minutiae).toHaveLength(13);
    expect(demonstration.referencePrint.minutiae).toHaveLength(12);
    expect(demonstration.trace.minutiae[0]).toEqual({
      index: 1,
      x: 100,
      y: 200,
      radius: 6,
      angleDeg: 0,
      color: '#d92b2b',
    });
    expect(demonstration.trace.minutiae[12].index).toBe(13);
  });

  it('ne compose aucune planche sans correspondance déclarée', () => {
    const model = build({
      data: { ...DATA, declaredHits: [], comparisons: [] },
    });

    expect(model.identityDemonstrations).toEqual([]);
  });
});

describe('buildTechnicalReport — journal des actes', () => {
  it("liste les actes chaînés dans l'ordre des maillons", () => {
    const { journal } = build();

    expect(journal.chained.map((entry) => entry.seq)).toEqual([2, 4]);
    expect(journal.chained[0].label).toBe('Trace déposée et mise sous scellé');
    expect(journal.chained[0].hash).toBe('e'.repeat(64));
  });
});
