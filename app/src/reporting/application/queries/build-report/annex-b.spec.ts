import type {
  CaseReportData,
  DeclaredHitData,
  MinutiaData,
  MinutiaPairData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import type { ReportImageViewModel } from '../../report-view-model';
import { buildAnnexB } from './annex-b';

const AT = new Date('2026-08-01T09:00:00.000Z');

function minutia(
  overrides: Partial<MinutiaData> & { id: string },
): MinutiaData {
  return {
    kind: 'minutia',
    x: 10,
    y: 20,
    radius: 6,
    angleDeg: null,
    color: '#d92b2b',
    typeLabel: 'indéterminée',
    ...overrides,
  };
}

function piece(overrides: Partial<PieceData> & { id: string }): PieceData {
  return {
    path: `media/case-1/${overrides.id}.png`,
    sha256: 'a'.repeat(64),
    displayableSha256: null,
    createdAt: AT,
    capturedAt: null,
    status: 'EXPLOITABLE',
    subjectId: null,
    position: null,
    layers: [],
    minutiae: [],
    withdrawnAt: null,
    withdrawalMotive: null,
    withdrawalMotiveDetail: null,
    imageDestroyedAt: null,
    number: 1,
    origin: null,
    location: null,
    revelationTechnique: null,
    cote: 'A',
    notIdentifiedAt: null,
    resolutionDpi: null,
    locationPhoto: null,
    ...overrides,
  };
}

function hit(overrides: Partial<DeclaredHitData> = {}): DeclaredHitData {
  return {
    traceId: 't1',
    referencePrintId: 'ref-1',
    declaredAt: AT,
    declaredBy: null,
    withdrawnAt: null,
    ...overrides,
  };
}

function pair(overrides: Partial<MinutiaPairData> = {}): MinutiaPairData {
  return {
    traceId: 't1',
    referencePrintId: 'ref-1',
    number: 1,
    traceMinutiaLayerId: 'trace-minutia-1',
    referenceMinutiaLayerId: 'ref-minutia-1',
    ...overrides,
  };
}

function subject(overrides: Partial<SubjectData> = {}): SubjectData {
  return {
    id: 'subject-1',
    firstName: 'Hélène',
    lastName: 'Berger',
    birthDate: null,
    birthPlace: null,
    sex: 'FEMALE',
    type: 'PERSON_OF_INTEREST',
    ...overrides,
  };
}

function caseData(overrides: Partial<CaseReportData> = {}): CaseReportData {
  return {
    investigationCase: {
      id: 'case-1',
      caseNumber: '3455',
      pvNumber: 'PV-2026-001',
      description: null,
      status: 'OPEN',
      createdAt: AT,
      requestDate: null,
      requesterQuality: null,
      requesterName: null,
      requesterService: null,
      offenseNature: null,
      offenseLocation: null,
      offenseDateFrom: null,
      offenseDateTo: null,
      interventionDate: null,
      caseAgainst: null,
      recipient: {
        authority: null,
        attentionQuality: null,
        attentionName: null,
      },
    },
    expertise: null,
    traces: [],
    referencePrints: [],
    comparisons: [],
    declaredHits: [],
    subjects: [],
    minutiaPairs: [],
    verifications: [],
    ...overrides,
  };
}

const NO_IMAGES = new Map<string, ReportImageViewModel | null>();

const PHOTO: ReportImageViewModel = {
  dataUrl: 'data:image/png;base64,photo',
  width: 800,
  height: 600,
  observedSha256: null,
  lifeSizeMm: null,
};

function build(
  data: CaseReportData,
  images: Map<string, ReportImageViewModel | null> = NO_IMAGES,
) {
  return buildAnnexB('3455', data, images);
}

const ROTATED_QUARTER = [
  {
    name: 'rotation',
    type: 'FILTER',
    zIndex: 0,
    isVisible: true,
    settings: { filterKey: 'rotation', value: 90 },
  },
];

const TREATED: ReportImageViewModel = {
  dataUrl: 'data:image/png;base64,retravaillee',
  width: 600,
  height: 800,
  observedSha256: null,
  lifeSizeMm: null,
};

describe('buildAnnexB — trace retravaillée', () => {
  function identifiedCase(layers: PieceData['layers']): CaseReportData {
    return caseData({
      traces: [
        piece({
          id: 't1',
          layers,
          minutiae: [minutia({ id: 'trace-minutia-1', x: 10, y: 20 })],
        }),
      ],
      referencePrints: [
        piece({
          id: 'ref-1',
          status: null,
          cote: null,
          minutiae: [minutia({ id: 'ref-minutia-1', x: 30, y: 40 })],
        }),
      ],
      declaredHits: [hit()],
      minutiaPairs: [pair()],
    });
  }

  const bothImages = new Map<string, ReportImageViewModel | null>([
    ['media/case-1/t1.png', PHOTO],
    ['media/case-1/t1.png@atelier', TREATED],
    ['media/case-1/ref-1.png', PHOTO],
  ]);

  it('démontre sur l’image que l’opérateur a retournée', () => {
    const [demonstration] = buildAnnexB(
      '3455',
      identifiedCase(ROTATED_QUARTER),
      bothImages,
    );

    expect(demonstration.trace.image).toBe(TREATED);
  });

  it('replace les minuties sur la reproduction retournée', () => {
    const [demonstration] = buildAnnexB(
      '3455',
      identifiedCase(ROTATED_QUARTER),
      bothImages,
    );

    expect(demonstration.trace.marks[0].x).toBeCloseTo(579, 5);
    expect(demonstration.trace.marks[0].y).toBeCloseTo(10, 5);
  });

  it('montre en plus la trace telle qu’elle est scellée', () => {
    const [demonstration] = buildAnnexB(
      '3455',
      identifiedCase(ROTATED_QUARTER),
      bothImages,
    );

    expect(demonstration.rawTrace).toBe(PHOTO);
  });

  it('ne montre pas deux fois la même image quand rien n’a été retravaillé', () => {
    const [demonstration] = buildAnnexB('3455', identifiedCase([]), bothImages);

    expect(demonstration.rawTrace).toBeNull();
    expect(demonstration.trace.image).toBe(PHOTO);
    expect(demonstration.trace.marks[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('s’en tient à la trace scellée quand la reproduction retravaillée manque', () => {
    const sansRetravail = new Map<string, ReportImageViewModel | null>([
      ['media/case-1/t1.png', PHOTO],
      ['media/case-1/t1.png@atelier', null],
      ['media/case-1/ref-1.png', PHOTO],
    ]);

    const [demonstration] = buildAnnexB(
      '3455',
      identifiedCase(ROTATED_QUARTER),
      sansRetravail,
    );

    expect(demonstration.trace.image).toBe(PHOTO);
    expect(demonstration.trace.marks[0]).toMatchObject({ x: 10, y: 20 });
    expect(demonstration.rawTrace).toBeNull();
  });

  it('retourne aussi l’empreinte de référence que l’opérateur a retournée', () => {
    const data = caseData({
      traces: [
        piece({
          id: 't1',
          minutiae: [minutia({ id: 'trace-minutia-1', x: 10, y: 20 })],
        }),
      ],
      referencePrints: [
        piece({
          id: 'ref-1',
          status: null,
          cote: null,
          layers: ROTATED_QUARTER,
          minutiae: [minutia({ id: 'ref-minutia-1', x: 10, y: 20 })],
        }),
      ],
      declaredHits: [hit()],
      minutiaPairs: [pair()],
    });
    const images = new Map<string, ReportImageViewModel | null>([
      ['media/case-1/t1.png', PHOTO],
      ['media/case-1/ref-1.png', PHOTO],
      ['media/case-1/ref-1.png@atelier', TREATED],
    ]);

    const [demonstration] = buildAnnexB('3455', data, images);

    expect(demonstration.referencePrint.image).toBe(TREATED);
    expect(demonstration.referencePrint.marks[0].x).toBeCloseTo(579, 5);
  });
});

describe('buildAnnexB', () => {
  it('ne retient que les traces identifiées', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1' }), piece({ id: 't2', number: 2 })],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations.map((one) => one.reference)).toEqual(['3455-T1']);
  });

  it('les range dans l’ordre des traces, pas dans celui des déclarations', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({ id: 't1', number: 1, cote: 'A' }),
          piece({ id: 't2', number: 2, cote: 'B' }),
        ],
        referencePrints: [
          piece({ id: 'ref-1', status: null, cote: null }),
          piece({ id: 'ref-2', status: null, cote: null }),
        ],
        declaredHits: [
          hit({ traceId: 't2', referencePrintId: 'ref-2' }),
          hit({ traceId: 't1', referencePrintId: 'ref-1' }),
        ],
      }),
    );

    expect(demonstrations.map((one) => one.cote)).toEqual(['A', 'B']);
  });

  it('porte les mêmes numéros sur la trace et sur l’empreinte', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [
              minutia({ id: 'tm-1', x: 10 }),
              minutia({ id: 'tm-2', x: 20 }),
              minutia({ id: 'tm-3', x: 30 }),
            ],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [
              minutia({ id: 'rm-1', x: 110 }),
              minutia({ id: 'rm-2', x: 120 }),
              minutia({ id: 'rm-3', x: 130 }),
            ],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            number: 1,
            traceMinutiaLayerId: 'tm-3',
            referenceMinutiaLayerId: 'rm-2',
          }),
          pair({
            number: 2,
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-3',
          }),
        ],
      }),
    );

    const [demonstration] = demonstrations;
    expect(demonstration.trace.marks).toEqual([
      { number: 1, x: 30, y: 20, radius: 6, label: 'indéterminée' },
      { number: 2, x: 10, y: 20, radius: 6, label: 'indéterminée' },
    ]);
    expect(demonstration.referencePrint.marks).toEqual([
      { number: 1, x: 120, y: 20, radius: 6, label: 'indéterminée' },
      { number: 2, x: 130, y: 20, radius: 6, label: 'indéterminée' },
    ]);
  });

  it('reprend le numéro déjà porté par la paire au lieu de recompter', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1', minutiae: [minutia({ id: 'tm-7' })] })],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ id: 'rm-7' })],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            number: 4,
            traceMinutiaLayerId: 'tm-7',
            referenceMinutiaLayerId: 'rm-7',
          }),
        ],
      }),
    );

    expect(demonstrations[0].trace.marks[0].number).toBe(4);
    expect(demonstrations[0].referencePrint.marks[0].number).toBe(4);
  });

  it('désigne la minutie par son identifiant, pas par sa place dans la liste', () => {
    const shuffled = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [
              minutia({ id: 'tm-2', x: 20 }),
              minutia({ id: 'tm-1', x: 10 }),
            ],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [
              minutia({ id: 'rm-2', x: 120 }),
              minutia({ id: 'rm-1', x: 110 }),
            ],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-1',
          }),
        ],
      }),
    );

    expect(shuffled[0].trace.marks).toEqual([
      { number: 1, x: 10, y: 20, radius: 6, label: 'indéterminée' },
    ]);
    expect(shuffled[0].referencePrint.marks).toEqual([
      { number: 1, x: 110, y: 20, radius: 6, label: 'indéterminée' },
    ]);
  });

  it('ne cercle pas les minuties non appariées', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [
              minutia({ id: 'tm-1', x: 10 }),
              minutia({ id: 'tm-2', x: 20 }),
            ],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [
              minutia({ id: 'rm-1', x: 110 }),
              minutia({ id: 'rm-2', x: 120 }),
            ],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-1',
          }),
        ],
      }),
    );

    expect(demonstrations[0].trace.marks).toHaveLength(1);
    expect(demonstrations[0].referencePrint.marks).toHaveLength(1);
  });

  it('n’imprime aucun numéro tant que l’appariement n’est pas enregistré', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [minutia({ id: 'tm-1' }), minutia({ id: 'tm-2' })],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ id: 'rm-1' }), minutia({ id: 'rm-2' })],
          }),
        ],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations[0].trace.marks).toEqual([]);
    expect(demonstrations[0].referencePrint.marks).toEqual([]);
  });

  it('ignore les paires d’une autre comparaison', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1', minutiae: [minutia({ id: 'tm-1' })] })],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ id: 'rm-1' })],
          }),
          piece({
            id: 'ref-2',
            status: null,
            cote: null,
            minutiae: [minutia({ id: 'rm-1' })],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            referencePrintId: 'ref-2',
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-1',
          }),
        ],
      }),
    );

    expect(demonstrations[0].trace.marks).toEqual([]);
  });

  it('écarte une paire dont un côté ne désigne aucune minutie', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1', minutiae: [minutia({ id: 'tm-1' })] })],
        referencePrints: [
          piece({ id: 'ref-1', status: null, cote: null, minutiae: [] }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-disparue',
          }),
        ],
      }),
    );

    expect(demonstrations[0].trace.marks).toEqual([]);
    expect(demonstrations[0].referencePrint.marks).toEqual([]);
  });

  it('conserve le numéro des paires complètes quand une paire est écartée', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [
              minutia({ id: 'tm-1', x: 10 }),
              minutia({ id: 'tm-2', x: 20 }),
            ],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ id: 'rm-2', x: 120 })],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            number: 1,
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-disparue',
          }),
          pair({
            number: 2,
            traceMinutiaLayerId: 'tm-2',
            referenceMinutiaLayerId: 'rm-2',
          }),
        ],
      }),
    );

    expect(demonstrations[0].trace.marks).toEqual([
      { number: 2, x: 20, y: 20, radius: 6, label: 'indéterminée' },
    ]);
  });

  it('oublie une identification retirée', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1' })],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
        declaredHits: [hit({ withdrawnAt: AT })],
      }),
    );

    expect(demonstrations).toEqual([]);
  });

  it('oublie une identification dont la pièce a été retirée du dossier', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({ id: 't1', withdrawnAt: AT, withdrawalMotive: 'MISFILED' }),
        ],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations).toEqual([]);
  });

  it('nomme la personne et le doigt de l’empreinte de référence', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1' })],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            subjectId: 'subject-1',
            position: 'RIGHT_INDEX',
          }),
        ],
        subjects: [subject()],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations[0].subject).toEqual({
      civility: 'Madame',
      firstName: 'Hélène',
      lastName: 'Berger',
    });
    expect(demonstrations[0].position).toBe('index droit');
  });

  it('ne dresse aucune planche pour une concordance avec un familier', () => {
    for (const type of ['CLOSE_ASSOCIATE', 'VICTIM']) {
      const demonstrations = build(
        caseData({
          traces: [piece({ id: 't1' })],
          referencePrints: [
            piece({
              id: 'ref-1',
              status: null,
              cote: null,
              subjectId: 'subject-1',
              position: 'RIGHT_INDEX',
            }),
          ],
          subjects: [subject({ type })],
          declaredHits: [hit()],
        }),
      );

      expect(demonstrations).toEqual([]);
    }
  });

  it('ne nomme personne quand l’empreinte n’est rattachée à aucune personne', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1' })],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations[0].subject).toBeNull();
    expect(demonstrations[0].position).toBeNull();
  });

  it('porte la localisation en clair de la trace démontrée', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            location: 'sur la face extérieure de la porte-fenêtre du séjour',
            locationPhoto: {
              path: 'media/case-1/t1-location.jpg',
              sha256: 'b'.repeat(64),
              sealedAt: AT,
            },
          }),
        ],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
        declaredHits: [hit()],
      }),
      new Map([['media/case-1/t1-location.jpg', PHOTO]]),
    );

    expect(demonstrations[0].location).toBe(
      'sur la face extérieure de la porte-fenêtre du séjour',
    );
  });

  it('n’ouvre aucune démonstration pour une trace non identifiée qui porte une photographie', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            locationPhoto: {
              path: 'media/case-1/t1-location.jpg',
              sha256: 'b'.repeat(64),
              sealedAt: AT,
            },
          }),
        ],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
      }),
      new Map([['media/case-1/t1-location.jpg', PHOTO]]),
    );

    expect(demonstrations).toEqual([]);
  });

  it('reprend le nom du point posé par l’expert quand il est déclaré', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [minutia({ id: 'tm-1', typeLabel: 'bifurcation' })],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ id: 'rm-1', typeLabel: 'bifurcation' })],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({
            traceMinutiaLayerId: 'tm-1',
            referenceMinutiaLayerId: 'rm-1',
          }),
        ],
      }),
    );

    expect(demonstrations[0].trace.marks[0].label).toBe('bifurcation');
  });
});
