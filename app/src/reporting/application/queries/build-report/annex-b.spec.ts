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

function minutia(overrides: Partial<MinutiaData> = {}): MinutiaData {
  return {
    kind: 'minutia',
    x: 10,
    y: 20,
    radius: 6,
    angleDeg: null,
    color: '#d92b2b',
    typeLabel: null,
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
    imageDestroyedAt: null,
    number: 1,
    origin: null,
    location: null,
    revelationTechnique: null,
    cote: 'A',
    notIdentifiedAt: null,
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
    traceMinutiaRank: 1,
    referenceMinutiaRank: 1,
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
    type: 'CLOSE_ASSOCIATE',
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
    ...overrides,
  };
}

const NO_IMAGES = new Map<string, ReportImageViewModel | null>();

function build(data: CaseReportData) {
  return buildAnnexB('3455', data, NO_IMAGES);
}

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
              minutia({ x: 10 }),
              minutia({ x: 20 }),
              minutia({ x: 30 }),
            ],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [
              minutia({ x: 110 }),
              minutia({ x: 120 }),
              minutia({ x: 130 }),
            ],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [
          pair({ traceMinutiaRank: 3, referenceMinutiaRank: 2 }),
          pair({ traceMinutiaRank: 1, referenceMinutiaRank: 3 }),
        ],
      }),
    );

    const [demonstration] = demonstrations;
    expect(demonstration.trace.marks).toEqual([
      { number: 1, x: 30, y: 20, radius: 6, label: null },
      { number: 2, x: 10, y: 20, radius: 6, label: null },
    ]);
    expect(demonstration.referencePrint.marks).toEqual([
      { number: 1, x: 120, y: 20, radius: 6, label: null },
      { number: 2, x: 130, y: 20, radius: 6, label: null },
    ]);
  });

  it('ne cercle pas les minuties non appariées', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [minutia({ x: 10 }), minutia({ x: 20 })],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ x: 110 }), minutia({ x: 120 })],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [pair()],
      }),
    );

    expect(demonstrations[0].trace.marks).toHaveLength(1);
    expect(demonstrations[0].referencePrint.marks).toHaveLength(1);
  });

  it('n’imprime aucun numéro tant que l’appariement n’est pas enregistré', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1', minutiae: [minutia(), minutia()] })],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia(), minutia()],
          }),
        ],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations[0].trace.marks).toEqual([]);
    expect(demonstrations[0].referencePrint.marks).toEqual([]);
  });

  it('écarte une paire dont un côté ne désigne aucune minutie', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1', minutiae: [minutia()] })],
        referencePrints: [
          piece({ id: 'ref-1', status: null, cote: null, minutiae: [] }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [pair()],
      }),
    );

    expect(demonstrations[0].trace.marks).toEqual([]);
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

  it('laisse la photographie de localisation vide tant qu’elle n’existe pas', () => {
    const demonstrations = build(
      caseData({
        traces: [piece({ id: 't1' })],
        referencePrints: [piece({ id: 'ref-1', status: null, cote: null })],
        declaredHits: [hit()],
      }),
    );

    expect(demonstrations[0].localisationPhoto).toBeNull();
  });

  it('reprend le nom du point posé par l’expert quand il est déclaré', () => {
    const demonstrations = build(
      caseData({
        traces: [
          piece({
            id: 't1',
            minutiae: [minutia({ typeLabel: 'bifurcation' })],
          }),
        ],
        referencePrints: [
          piece({
            id: 'ref-1',
            status: null,
            cote: null,
            minutiae: [minutia({ typeLabel: 'bifurcation' })],
          }),
        ],
        declaredHits: [hit()],
        minutiaPairs: [pair()],
      }),
    );

    expect(demonstrations[0].trace.marks[0].label).toBe('bifurcation');
  });
});
