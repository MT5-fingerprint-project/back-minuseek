import { TraceabilityReportViewModel } from '../../../application/report-view-model';
import { renderTraceabilityReportHtml } from './traceability-report.template';

const MODEL: TraceabilityReportViewModel = {
  kind: 'TRACEABILITY',
  header: {
    reportId: 'report-2',
    chainHeadSeq: 7,
    chainHeadHash: 'c'.repeat(64),
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2026-001',
    caseStatus: 'OPEN',
    openedAt: new Date('2026-08-01T09:00:00.000Z'),
    generatedAt: new Date('2026-08-19T08:00:00.000Z'),
    generatedByDisplayName: 'Alex Martin',
  },
  events: [
    {
      seq: 2,
      eventType: 'CASE_OPENED',
      evidenceClass: 'OBSERVED',
      actorDisplayName: 'Alex Martin',
      occurredAt: new Date('2026-08-01T09:00:00.000Z'),
      payload: { caseNumber: '<b>AFF-001</b>' },
      hash: 'a'.repeat(64),
      prevHash: 'b'.repeat(64),
    },
  ],
  hashSpine: [
    { seq: 1, hash: 'b'.repeat(64) },
    { seq: 2, hash: 'a'.repeat(64) },
  ],
  anchors: [],
  attestation: {
    ok: true,
    eventsChecked: 2,
    firstBrokenSeq: null,
    anchorsVerified: 0,
    anchorsFailed: 0,
  },
};

describe('renderTraceabilityReportHtml', () => {
  it('atteste une chaîne intacte', () => {
    const html = renderTraceabilityReportHtml(MODEL);

    expect(html).toContain('aucune rupture détectée');
    expect(html).toContain('Maillons recalculés');
  });

  it('refuse d attester quand la chaîne est rompue', () => {
    const html = renderTraceabilityReportHtml({
      ...MODEL,
      attestation: { ...MODEL.attestation, ok: false, firstBrokenSeq: 3 },
    });

    expect(html).toContain('Rupture détectée');
    expect(html).toContain('maillon 3');
    expect(html).toContain("ne vaut pas attestation d'intégrité");
  });

  it("imprime l'épine de hashes complète du laboratoire", () => {
    const html = renderTraceabilityReportHtml(MODEL);

    expect(html).toContain(`1 ${'b'.repeat(64)}`);
    expect(html).toContain(`2 ${'a'.repeat(64)}`);
  });

  it('dit ce que vaut une chaîne sans ancre', () => {
    const html = renderTraceabilityReportHtml(MODEL);

    expect(html).toContain('Aucune ancre');
    expect(html).toContain('sans datation opposable');
  });

  it('échappe le payload venu de la base', () => {
    const html = renderTraceabilityReportHtml(MODEL);

    expect(html).not.toContain('<b>AFF-001</b>');
    expect(html).toContain('&lt;b&gt;AFF-001&lt;/b&gt;');
  });
});
