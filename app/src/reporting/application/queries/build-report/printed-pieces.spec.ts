import type {
  CaseReportData,
  DeclaredHitData,
  PieceData,
} from '../../ports/case-report-data.reader';
import {
  lifeSizeKey,
  locatedTraces,
  printedImages,
  printedPieces,
  treatedKey,
} from './printed-pieces';

const AT = new Date('2026-08-01T09:00:00.000Z');

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

function idsOf(data: CaseReportData): string[] {
  return printedPieces(data).map((printed) => printed.id);
}

describe('printedPieces', () => {
  it('embarque les traces exploitables', () => {
    expect(idsOf(caseData({ traces: [piece({ id: 't1' })] }))).toEqual(['t1']);
  });

  it('n’embarque pas une trace inexploitable que personne n’a identifiée', () => {
    expect(
      idsOf(
        caseData({
          traces: [piece({ id: 't1', status: 'NOT_EXPLOITABLE', cote: null })],
        }),
      ),
    ).toEqual([]);
  });

  it('embarque une trace identifiée même déclarée inexploitable', () => {
    expect(
      idsOf(
        caseData({
          traces: [piece({ id: 't1', status: 'NOT_EXPLOITABLE', cote: null })],
          referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
          declaredHits: [hit()],
        }),
      ),
    ).toEqual(['t1', 'ref-1']);
  });

  it('n’embarque une empreinte de référence que si elle porte une identification', () => {
    expect(
      idsOf(
        caseData({
          referencePrints: [
            piece({ id: 'ref-1', status: null, cote: null }),
            piece({ id: 'ref-2', status: null, cote: null }),
          ],
          traces: [piece({ id: 't1' })],
          declaredHits: [hit()],
        }),
      ),
    ).toEqual(['t1', 'ref-1']);
  });

  it('oublie une identification retirée', () => {
    expect(
      idsOf(
        caseData({
          traces: [piece({ id: 't1', status: 'NOT_EXPLOITABLE', cote: null })],
          referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
          declaredHits: [hit({ withdrawnAt: AT })],
        }),
      ),
    ).toEqual([]);
  });

  it('n’embarque ni une pièce retirée du dossier ni une image détruite', () => {
    expect(
      idsOf(
        caseData({
          traces: [
            piece({ id: 't1', withdrawnAt: AT, withdrawalMotive: 'MISFILED' }),
            piece({ id: 't2', imageDestroyedAt: AT }),
          ],
        }),
      ),
    ).toEqual([]);
  });
});

const LOCATION_PHOTO = {
  path: 'media/case-1/t1-location.jpg',
  sha256: 'b'.repeat(64),
  sealedAt: AT,
};

describe('printedImages', () => {
  function keysOf(data: Parameters<typeof printedImages>[0]): string[] {
    return printedImages(data).map((request) => request.key);
  }

  const ROTATED = [
    {
      name: 'rotation',
      type: 'FILTER',
      zIndex: 0,
      isVisible: true,
      settings: { filterKey: 'rotation', value: 90 },
    },
  ];

  function demonstrated(layers: PieceData['layers']) {
    return caseData({
      traces: [piece({ id: 't1', layers })],
      referencePrints: [piece({ id: 'ref-1', status: null })],
      declaredHits: [
        {
          traceId: 't1',
          referencePrintId: 'ref-1',
          declaredAt: AT,
          declaredBy: null,
          withdrawnAt: null,
        },
      ],
    });
  }

  it('embarque en plus la pièce retravaillée quand l’opérateur l’a retournée', () => {
    const keys = keysOf(demonstrated(ROTATED));

    expect(keys).toContain(treatedKey('media/case-1/t1.png'));
  });

  it('n’embarque la reproduction retravaillée que des pièces démontrées', () => {
    const keys = keysOf(
      caseData({
        traces: [
          piece({ id: 't1', layers: ROTATED }),
          piece({ id: 't2', layers: ROTATED }),
        ],
        referencePrints: [piece({ id: 'ref-1', status: null })],
        declaredHits: [
          {
            traceId: 't1',
            referencePrintId: 'ref-1',
            declaredAt: AT,
            declaredBy: null,
            withdrawnAt: null,
          },
        ],
      }),
    );

    expect(keys).toContain(treatedKey('media/case-1/t1.png'));
    expect(keys).not.toContain(treatedKey('media/case-1/t2.png'));
  });

  it('n’embarque pas de reproduction retravaillée quand rien n’a bougé', () => {
    const keys = keysOf(demonstrated([]));

    expect(keys).not.toContain(treatedKey('media/case-1/t1.png'));
  });

  it('porte la géométrie enregistrée sur la demande d’embarquement', () => {
    const requests = printedImages(demonstrated(ROTATED));

    expect(
      requests.find(
        (request) => request.key === treatedKey('media/case-1/t1.png'),
      ),
    ).toMatchObject({
      path: 'media/case-1/t1.png',
      resolutionDpi: null,
      geometry: { rotationDeg: 90, mirrored: false },
    });
  });

  it('embarque la photographie de localisation de toute trace exploitable photographiée', () => {
    const keys = keysOf(
      caseData({
        traces: [piece({ id: 't1', locationPhoto: LOCATION_PHOTO })],
      }),
    );

    expect(keys).toContain(LOCATION_PHOTO.path);
  });

  it('embarque en plus la trace à l’échelle 1 quand elle est calibrée', () => {
    const keys = keysOf(
      caseData({
        traces: [
          piece({
            id: 't1',
            locationPhoto: LOCATION_PHOTO,
            resolutionDpi: 3555,
          }),
        ],
      }),
    );

    expect(keys).toContain(lifeSizeKey('media/case-1/t1.png'));
    expect(
      printedImages(
        caseData({
          traces: [
            piece({
              id: 't1',
              locationPhoto: LOCATION_PHOTO,
              resolutionDpi: 3555,
            }),
          ],
        }),
      ).find((request) => request.key === lifeSizeKey('media/case-1/t1.png')),
    ).toMatchObject({ path: 'media/case-1/t1.png', resolutionDpi: 3555 });
  });

  it('n’embarque aucune échelle 1 pour une trace non calibrée', () => {
    const keys = keysOf(
      caseData({
        traces: [
          piece({
            id: 't1',
            locationPhoto: LOCATION_PHOTO,
            resolutionDpi: null,
          }),
        ],
      }),
    );

    expect(keys).not.toContain(lifeSizeKey('media/case-1/t1.png'));
  });

  it('n’embarque pas la photographie d’une trace retirée du dossier', () => {
    const keys = keysOf(
      caseData({
        traces: [
          piece({
            id: 't1',
            withdrawnAt: AT,
            withdrawalMotive: 'MISFILED',
            locationPhoto: LOCATION_PHOTO,
            resolutionDpi: 3555,
          }),
        ],
      }),
    );

    expect(keys).not.toContain(LOCATION_PHOTO.path);
    expect(keys).not.toContain(lifeSizeKey('media/case-1/t1.png'));
  });

  it('demande les pièces de l’inventaire sans échelle imposée', () => {
    const requests = printedImages(
      caseData({
        traces: [piece({ id: 't1', resolutionDpi: 3555 })],
      }),
    );

    expect(requests).toContainEqual({
      key: 'media/case-1/t1.png',
      path: 'media/case-1/t1.png',
      resolutionDpi: null,
      geometry: null,
    });
  });
});

describe('locatedTraces', () => {
  it('ne retient que les traces exploitables, cotées et photographiées', () => {
    const data = caseData({
      traces: [
        piece({ id: 'photographiee', locationPhoto: LOCATION_PHOTO }),
        piece({ id: 'sans-photo' }),
        piece({
          id: 'non-exploitable',
          status: 'RECEIVED',
          locationPhoto: LOCATION_PHOTO,
        }),
      ],
    });

    expect(locatedTraces(data).map((trace) => trace.id)).toEqual([
      'photographiee',
    ]);
  });
});
