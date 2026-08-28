import type {
  CaseReportData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import { designationOf, pieceDesignations } from './piece-designations';

const AT = new Date('2026-03-16T17:03:00.000Z');

function piece(overrides: Partial<PieceData> & { id: string }): PieceData {
  return {
    path: `media/case-1/${overrides.id}.png`,
    sha256: null,
    createdAt: AT,
    capturedAt: null,
    status: 'EXPLOITABLE',
    subjectId: null,
    position: null,
    layers: [],
    minutiae: [],
    withdrawnAt: null,
    withdrawalMotive: null,
    imageDestroyedAt: null,
    number: null,
    origin: null,
    location: null,
    revelationTechnique: null,
    cote: null,
    notIdentifiedAt: null,
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
    traces: [],
    referencePrints: [],
    comparisons: [],
    declaredHits: [],
    subjects: [],
    minutiaPairs: [],
    ...overrides,
  };
}

const HELENE: SubjectData = {
  id: 'subject-1',
  firstName: 'Hélène',
  lastName: 'Berger',
  birthDate: null,
  birthPlace: null,
  sex: 'FEMALE',
  type: 'CLOSE_ASSOCIATE',
};

describe('pieceDesignations — les traces', () => {
  it('désigne une trace par son numéro et sa cote', () => {
    const named = pieceDesignations(
      caseData({ traces: [piece({ id: 't7', number: 7, cote: 'B' })] }),
    );

    expect(named.get('t7')).toEqual({
      full: 'la trace 3455-T7 cotée « B »',
      bare: 'la trace 3455-T7',
    });
  });

  it('s’en tient au numéro tant qu’aucune cote n’est attribuée', () => {
    const named = pieceDesignations(
      caseData({ traces: [piece({ id: 't7', number: 7 })] }),
    );

    expect(named.get('t7')?.full).toBe('la trace 3455-T7');
  });

  it('nomme génériquement une trace sans numéro plutôt qu’un identifiant technique', () => {
    const named = pieceDesignations(
      caseData({ traces: [piece({ id: 't7' })] }),
    );

    expect(named.get('t7')?.full).toBe('une trace papillaire');
  });
});

describe('pieceDesignations — les empreintes de référence', () => {
  it('désigne une empreinte par son doigt et sa personne', () => {
    const named = pieceDesignations(
      caseData({
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            position: 'RIGHT_INDEX',
            subjectId: 'subject-1',
          }),
        ],
        subjects: [HELENE],
      }),
    );

    expect(named.get('ref-1')?.full).toBe(
      "l'empreinte de l'index droit de Madame BERGER Hélène",
    );
  });

  it('élide l’article selon le doigt', () => {
    const named = pieceDesignations(
      caseData({
        referencePrints: [
          piece({ id: 'ref-1', status: null, position: 'RIGHT_THUMB' }),
          piece({ id: 'ref-2', status: null, position: 'LEFT_PALM' }),
        ],
      }),
    );

    expect(named.get('ref-1')?.full).toBe("l'empreinte du pouce droit");
    expect(named.get('ref-2')?.full).toBe("l'empreinte de la paume gauche");
  });

  it('nomme la personne seule quand le doigt n’est pas renseigné', () => {
    const named = pieceDesignations(
      caseData({
        referencePrints: [
          piece({ id: 'ref-1', status: null, subjectId: 'subject-1' }),
        ],
        subjects: [HELENE],
      }),
    );

    expect(named.get('ref-1')?.full).toBe(
      "l'empreinte de Madame BERGER Hélène",
    );
  });

  it('nomme génériquement une empreinte rattachée à personne et sans doigt', () => {
    const named = pieceDesignations(
      caseData({ referencePrints: [piece({ id: 'ref-1', status: null })] }),
    );

    expect(named.get('ref-1')?.full).toBe('une empreinte de référence');
  });
});

describe('designationOf', () => {
  it('rend la désignation connue', () => {
    const named = pieceDesignations(
      caseData({ traces: [piece({ id: 't7', number: 7 })] }),
    );

    expect(designationOf(named, 't7').full).toBe('la trace 3455-T7');
  });

  it('rend le repli quand le maillon ne porte pas d’identifiant', () => {
    expect(designationOf(new Map(), undefined).full).toBe(
      'une pièce du dossier',
    );
  });

  it('rend le repli demandé plutôt que le repli générique', () => {
    expect(
      designationOf(new Map(), null, 'une empreinte de référence').full,
    ).toBe('une empreinte de référence');
  });
});
