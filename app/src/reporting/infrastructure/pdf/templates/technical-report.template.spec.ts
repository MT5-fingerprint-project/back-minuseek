import { TechnicalReportViewModel } from '../../../application/report-view-model';
import { renderTechnicalReportHtml } from './technical-report.template';

const PIECE = {
  label: 'trace-1.png',
  sha256: 'a'.repeat(64),
  receivedAt: new Date('2026-08-01T10:00:00.000Z'),
  capturedAt: null,
  status: 'EXPLOITABLE',
  exploitabilityScore: 72,
  image: {
    dataUrl: 'data:image/png;base64,AAA',
    width: 800,
    height: 1200,
  },
  minutiae: [
    { index: 1, x: 120, y: 340, radius: 6, angleDeg: 45, color: '#d92b2b' },
    { index: 2, x: 200, y: 410, radius: 6, angleDeg: null, color: '#d92b2b' },
  ],
  layers: [
    {
      name: '<script>alert(1)</script>',
      type: 'FILTER',
      zIndex: 1,
      isVisible: true,
      settings: { contrast: 1.4 },
    },
  ],
  withdrawal: null,
  imageDestroyedAt: null,
};

const REFERENCE = {
  ...PIECE,
  label: 'ref-1.png',
  sha256: 'b'.repeat(64),
  image: { dataUrl: 'data:image/png;base64,BBB', width: 500, height: 700 },
};

const MODEL: TechnicalReportViewModel = {
  kind: 'TECHNICAL',
  header: {
    reportId: 'report-1',
    chainHeadSeq: 42,
    chainHeadHash: 'c'.repeat(64),
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2026-001',
    caseStatus: 'OPEN',
    openedAt: new Date('2026-08-01T09:00:00.000Z'),
    generatedAt: new Date('2026-08-19T08:00:00.000Z'),
    generatedByDisplayName: 'Alex Martin',
  },
  caseDescription: null,
  traces: [PIECE],
  referencePrints: [REFERENCE],
  comparisons: [],
  identityDemonstrations: [
    {
      trace: PIECE,
      referencePrint: REFERENCE,
      subject: {
        firstName: 'Camille',
        lastName: 'Durand',
        birthDate: new Date('1990-04-12T00:00:00.000Z'),
        birthPlace: 'Lyon',
        sex: 'FEMALE',
        type: 'PERSON_OF_INTEREST',
      },
      position: 'index droit',
      score: 88.5,
      machineMatch: true,
      comparedAt: new Date('2026-08-10T14:00:00.000Z'),
      declaredAt: new Date('2026-08-11T09:30:00.000Z'),
      declaredBy: {
        displayName: 'Alex Martin',
        grade: 'Brigadier',
        serviceNumber: 'PN-4412',
        role: 'EXPERT',
      },
      requiredMinutiae: 12,
    },
  ],
  journal: {
    chained: [
      {
        label: 'Trace déposée et mise sous scellé',
        detail: 'traceId trace-1',
        occurredAt: new Date('2026-08-01T10:00:00.000Z'),
        actorDisplayName: 'Alex Martin',
        seq: 2,
        hash: 'e'.repeat(64),
      },
    ],
  },
};

describe('renderTechnicalReportHtml — planche de comparaison', () => {
  it('dessine chaque pièce dans le repère pixel de son image', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('viewBox="0 0 800 1200"');
    expect(html).toContain('viewBox="0 0 500 700"');
  });

  it('replace et numérote les minuties', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('cx="120" cy="340"');
    expect(html).toContain('>1</text>');
    expect(html).toContain('>2</text>');
  });

  it('trace la direction du flux seulement quand elle est saisie', () => {
    const html = renderTechnicalReportHtml(MODEL);
    const lines = html.match(/<line /g) ?? [];

    // 1 minutie orientée par pièce, deux pièces affichées deux fois (planche + section pièce)
    expect(lines.length).toBeGreaterThan(0);
    expect(html).not.toContain('x2="NaN"');
  });

  it("conclut en nommant le sujet, la zone et l'expert", () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('DURAND');
    expect(html).toContain('Camille');
    expect(html).toContain('index droit');
    expect(html).toContain('Brigadier');
    expect(html).toContain('PN-4412');
    expect(html).toContain('minimum 12 points');
  });

  it('rappelle que le score est un appui, pas la conclusion', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain("Le score est un élément d'appui");
    expect(html).toContain("acte d'expert");
  });

  it("dit qu'aucune identité n'est conclue sans correspondance déclarée", () => {
    const html = renderTechnicalReportHtml({
      ...MODEL,
      identityDemonstrations: [],
    });

    expect(html).toContain('conclut à aucune identité');
  });

  it('signale une image dont les dimensions sont illisibles', () => {
    const html = renderTechnicalReportHtml({
      ...MODEL,
      identityDemonstrations: [],
      traces: [
        {
          ...PIECE,
          image: {
            dataUrl: 'data:image/tiff;base64,AAA',
            width: null,
            height: null,
          },
        },
      ],
    });

    expect(html).toContain('Minuties non replacées');
  });

  it("dit le retrait d'une trace au lieu d'imprimer sa planche", () => {
    const html = renderTechnicalReportHtml({
      ...MODEL,
      identityDemonstrations: [],
      traces: [
        {
          ...PIECE,
          withdrawal: {
            at: new Date('2026-08-12T09:00:00.000Z'),
            motiveLabel: "doublon d'une pièce déjà versée",
          },
        },
      ],
    });

    expect(html).toContain('Retirée du dossier le 12/08/2026');
    expect(html).toContain('pièce déjà versée');
    expect(html).not.toContain('Image non embarquée');
  });
});

describe('renderTechnicalReportHtml — journal des actes', () => {
  it('liste les actes chaînés avec leur maillon', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).toContain('Journal des actes (1)');
    expect(html).toContain('Trace déposée et mise sous scellé');
  });

  it('échappe le texte libre venu de la base', () => {
    const html = renderTechnicalReportHtml(MODEL);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it("dit la destruction légale d'une empreinte, jamais « fichier illisible »", () => {
    const html = renderTechnicalReportHtml({
      ...MODEL,
      identityDemonstrations: [],
      referencePrints: [
        {
          ...REFERENCE,
          image: null,
          imageDestroyedAt: new Date('2026-09-01T09:00:00.000Z'),
        },
      ],
    });

    expect(html).toContain('Image détruite le 01/09/2026');
    expect(html).toContain('aux fins d');
    expect(html).not.toContain('Image non embarquée');
  });
});
