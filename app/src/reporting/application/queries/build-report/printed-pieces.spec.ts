import type {
  CaseReportData,
  DeclaredHitData,
  PieceData,
} from '../../ports/case-report-data.reader';
import { printedImagePaths, printedPieces } from './printed-pieces';

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

describe('printedImagePaths', () => {
  it('embarque la photographie de localisation d’une trace identifiée', () => {
    expect(
      printedImagePaths(
        caseData({
          traces: [piece({ id: 't1', locationPhoto: LOCATION_PHOTO })],
          referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
          declaredHits: [hit()],
        }),
      ),
    ).toEqual([
      'media/case-1/t1.png',
      'media/case-1/ref-1.png',
      LOCATION_PHOTO.path,
    ]);
  });

  it('n’embarque pas la photographie d’une trace exploitable que personne n’a identifiée', () => {
    expect(
      printedImagePaths(
        caseData({
          traces: [piece({ id: 't1', locationPhoto: LOCATION_PHOTO })],
        }),
      ),
    ).toEqual(['media/case-1/t1.png']);
  });

  it('n’embarque pas la photographie d’une trace retirée du dossier', () => {
    expect(
      printedImagePaths(
        caseData({
          traces: [
            piece({
              id: 't1',
              withdrawnAt: AT,
              withdrawalMotive: 'MISFILED',
              locationPhoto: LOCATION_PHOTO,
            }),
          ],
          referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
          declaredHits: [hit()],
        }),
      ),
    ).not.toContain(LOCATION_PHOTO.path);
  });
});
