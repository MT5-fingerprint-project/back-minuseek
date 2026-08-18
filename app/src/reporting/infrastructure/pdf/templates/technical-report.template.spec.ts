import { TechnicalReportViewModel } from '../../../application/report-view-model';
import { renderTechnicalReportHtml } from './technical-report.template';

const MODEL: TechnicalReportViewModel = {
  kind: 'TECHNICAL',
  header: {
    reportId: 'report-1',
    chainHeadSeq: 42,
    chainHeadHash: 'b'.repeat(64),
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2026-001',
    caseStatus: 'OPEN',
    openedAt: new Date('2026-08-01T09:00:00.000Z'),
    generatedAt: new Date('2026-08-19T08:00:00.000Z'),
    generatedByDisplayName: 'Alex Martin',
  },
  caseDescription: null,
  traces: [
    {
      label: 'trace-1.png',
      sha256: null,
      receivedAt: new Date('2026-08-01T10:00:00.000Z'),
      capturedAt: null,
      status: 'EXPLOITABLE',
      exploitabilityScore: 72,
      imageDataUrl: null,
      layers: [
        {
          name: '<script>alert(1)</script>',
          type: 'FILTER',
          zIndex: 1,
          isVisible: true,
          settings: { contrast: 1.4 },
        },
      ],
    },
  ],
  referencePrints: [],
  comparisons: [],
};

describe('renderTechnicalReportHtml', () => {
  it('titre le rapport avec le dossier', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('Rapport technique');
    expect(html).toContain('AFF-001');
    expect(html).toContain('PV-2026-001');
  });

  it('échappe le texte libre venu de la base', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('dit explicitement qu une pièce n est pas scellée', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('non scellée');
  });

  it('rattache le document au maillon de chaîne du moment', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('Chaîne au maillon 42');
    expect(html).toContain('b'.repeat(64));
  });
});
