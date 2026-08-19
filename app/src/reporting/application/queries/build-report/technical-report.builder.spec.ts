import type { CaseReportData } from '../../ports/case-report-data.reader';
import { buildTechnicalReport } from './technical-report.builder';

const OPENED_AT = new Date('2026-08-01T09:00:00.000Z');
const GENERATED_AT = new Date('2026-08-19T08:00:00.000Z');

const DATA: CaseReportData = {
  investigationCase: {
    id: 'case-1',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2026-001',
    description: 'Cambriolage rue des Lilas',
    status: 'OPEN',
    createdAt: OPENED_AT,
  },
  traces: [
    {
      id: 'trace-1',
      path: 'media/investigation-case/case-1/traces/trace-1.png',
      sha256: 'a'.repeat(64),
      createdAt: OPENED_AT,
      capturedAt: null,
      status: 'EXPLOITABLE',
      score: 72,
      layers: [
        {
          name: 'Contraste',
          type: 'FILTER',
          zIndex: 1,
          isVisible: true,
          settings: { contrast: 1.4 },
        },
      ],
    },
  ],
  referencePrints: [
    {
      id: 'ref-1',
      path: 'media/investigation-case/case-1/reference-prints/ref-1.jpg',
      sha256: null,
      createdAt: OPENED_AT,
      capturedAt: null,
      status: null,
      score: null,
      layers: [],
    },
  ],
  comparisons: [
    {
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      score: 88.5,
      machineMatch: true,
      declaredHit: true,
      comparedAt: GENERATED_AT,
    },
  ],
};

describe('buildTechnicalReport', () => {
  function build(images = new Map<string, string | null>()) {
    return buildTechnicalReport({
      data: DATA,
      reportId: 'report-1',
      chainHead: { seq: 42, hash: 'b'.repeat(64) },
      generatedAt: GENERATED_AT,
      generatedByDisplayName: 'Alex Martin',
      images,
    });
  }

  it('rattache le rapport au dossier et au maillon de chaîne du moment', () => {
    const model = build();

    expect(model.header).toEqual({
      reportId: 'report-1',
      chainHeadSeq: 42,
      chainHeadHash: 'b'.repeat(64),
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2026-001',
      caseStatus: 'OPEN',
      openedAt: OPENED_AT,
      generatedAt: GENERATED_AT,
      generatedByDisplayName: 'Alex Martin',
    });
  });

  it('nomme les pièces par leur fichier et reporte leurs calques', () => {
    const model = build();

    expect(model.traces[0].label).toBe('trace-1.png');
    expect(model.traces[0].sha256).toBe('a'.repeat(64));
    expect(model.traces[0].layers).toEqual([
      {
        name: 'Contraste',
        type: 'FILTER',
        zIndex: 1,
        isVisible: true,
        settings: { contrast: 1.4 },
      },
    ]);
  });

  it('remplace les identifiants par les libellés dans les comparaisons', () => {
    const model = build();

    expect(model.comparisons[0]).toEqual({
      traceLabel: 'trace-1.png',
      referencePrintLabel: 'ref-1.jpg',
      score: 88.5,
      machineMatch: true,
      declaredHit: true,
      comparedAt: GENERATED_AT,
    });
  });

  it("embarque l'image quand elle a pu être lue, et rien sinon", () => {
    const withImage = build(
      new Map([
        [
          'media/investigation-case/case-1/traces/trace-1.png',
          'data:image/png;base64,AAA',
        ],
      ]),
    );

    expect(withImage.traces[0].imageDataUrl).toBe('data:image/png;base64,AAA');
    expect(withImage.referencePrints[0].imageDataUrl).toBeNull();
  });
});
