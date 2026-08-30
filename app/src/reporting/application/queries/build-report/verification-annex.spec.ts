import type {
  CaseReportData,
  PieceData,
  VerificationReportData,
} from '../../ports/case-report-data.reader';
import { AuditEventData } from '../../ports/traceability-data.reader';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { pieceDesignations } from './piece-designations';
import { buildVerificationAnnexes } from './verification-annex';

const AT = new Date('2026-08-01T08:00:00.000Z');

const LUCIE = {
  identityProviderId: 'sub-lucie',
  firstName: 'Lucie',
  lastName: 'Bernard',
  grade: 'Brigadier',
  serviceNumber: 'PTS-0042',
  role: 'OPERATOR',
};

function piece(overrides: Partial<PieceData> & { id: string }): PieceData {
  return {
    path: `media/case-1/${overrides.id}.png`,
    sha256: null,
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
    number: null,
    origin: null,
    location: null,
    revelationTechnique: null,
    cote: null,
    notIdentifiedAt: null,
    locationPhoto: null,
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
    traces: [
      piece({ id: 'trace-1', number: 1, cote: 'A' }),
      piece({ id: 'trace-2', number: 2, cote: 'B' }),
    ],
    referencePrints: [],
    comparisons: [],
    declaredHits: [],
    subjects: [],
    minutiaPairs: [],
    verifications: [],
    ...overrides,
  };
}

function aVerification(
  overrides: Partial<VerificationReportData> = {},
): VerificationReportData {
  return {
    id: 'verification-1',
    verifier: LUCIE,
    status: 'CONCORDANT',
    requestedAt: new Date('2026-08-10T08:00:00.000Z'),
    completedAt: new Date('2026-08-12T08:00:00.000Z'),
    decisions: [
      {
        traceId: 'trace-1',
        exploitability: 'EXPLOITABLE',
        identifiedReferencePrintId: 'ref-1',
        outcome: 'CONCORDANT',
        statedAt: new Date('2026-08-11T08:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

function anAct(overrides: Partial<AuditEventData> = {}): AuditEventData {
  return {
    seq: 10,
    eventType: AuditEventTypeEnum.LAYER_CREATED,
    traceId: 'trace-1',
    evidenceClass: 'OBSERVED',
    actorDisplayName: 'Lucie Bernard',
    actorSub: 'sub-lucie',
    occurredAt: new Date('2026-08-11T09:00:00.000Z'),
    payload: {
      fingerprintId: 'trace-1',
      type: 'ANNOTATION',
      settings: { type: 'circle' },
    },
    hash: 'a'.repeat(64),
    prevHash: 'b'.repeat(64),
    ...overrides,
  };
}

function annexesOf(
  verifications: VerificationReportData[],
  chainEvents: AuditEventData[] = [],
) {
  const data = caseData({ verifications });
  return buildVerificationAnnexes(data, chainEvents, pieceDesignations(data));
}

describe('buildVerificationAnnexes', () => {
  it("n'écrit aucune annexe sur un dossier jamais vérifié", () => {
    expect(annexesOf([])).toEqual([]);
  });

  it('laisse de côté une mission encore en cours', () => {
    expect(
      annexesOf([
        aVerification({ status: 'PENDING', completedAt: null, decisions: [] }),
      ]),
    ).toEqual([]);
  });

  it('nomme le vérificateur, sa qualité et la date de sa validation', () => {
    const [annexe] = annexesOf([aVerification()]);

    expect(annexe.verifier).toEqual({
      displayName: 'Lucie Bernard',
      grade: 'Brigadier',
      serviceNumber: 'PTS-0042',
      role: 'OPERATOR',
    });
    expect(annexe.completedAt).toEqual(new Date('2026-08-12T08:00:00.000Z'));
    expect(annexe.verdictLabel).toBe('Vérification concordante');
  });

  it('porte une ligne par trace du dossier, désignée comme dans le rapport', () => {
    const [annexe] = annexesOf([
      aVerification({
        status: 'DISCORDANT',
        decisions: [
          {
            traceId: 'trace-1',
            exploitability: 'EXPLOITABLE',
            identifiedReferencePrintId: null,
            outcome: 'DISCORDANT',
            statedAt: new Date('2026-08-11T08:00:00.000Z'),
          },
        ],
      }),
    ]);

    expect(annexe.traces).toEqual([
      {
        traceDesignation: 'la trace 3455-T1 cotée « A »',
        resultLabel: 'Discordance — un troisième examen est nécessaire',
      },
      {
        traceDesignation: 'la trace 3455-T2 cotée « B »',
        resultLabel: 'Non conclue par le vérificateur',
      },
    ]);
  });

  it('regroupe par pièce les actes du vérificateur, et ceux-là seuls', () => {
    const [annexe] = annexesOf(
      [aVerification()],
      [
        anAct({ seq: 11 }),
        anAct({
          seq: 12,
          traceId: 'trace-2',
          payload: {
            fingerprintId: 'trace-2',
            type: 'ANNOTATION',
            settings: { type: 'circle' },
          },
        }),
        anAct({
          seq: 13,
          traceId: null,
          eventType: AuditEventTypeEnum.REPORT_GENERATED,
          payload: {},
        }),
        anAct({ seq: 14, actorSub: 'sub-marie', actorDisplayName: 'Marie' }),
      ],
    );

    expect(
      annexe.actGroups.map((group) => [
        group.pieceDesignation,
        group.acts.map((act) => act.order),
      ]),
    ).toEqual([
      ['la trace 3455-T1 cotée « A »', [1]],
      ['la trace 3455-T2 cotée « B »', [1]],
      ['le dossier', [1]],
    ]);
  });

  it('écrit chaque acte en français, comme le journal', () => {
    const [annexe] = annexesOf([aVerification()], [anAct()]);

    expect(annexe.actGroups[0].acts[0].sentence).toBe(
      'Minutie relevée sur la trace 3455-T1 cotée « A »',
    );
    expect(annexe.actGroups[0].acts[0].actorDisplayName).toBe('Lucie Bernard');
  });

  it('ne compte pas les actes posés avant la mission', () => {
    const [annexe] = annexesOf(
      [aVerification()],
      [anAct({ seq: 5, occurredAt: new Date('2026-08-02T08:00:00.000Z') })],
    );

    expect(annexe.actGroups).toEqual([]);
  });

  it('lit deux vérifications successives dans leur ordre de validation', () => {
    const annexes = annexesOf([
      aVerification({
        id: 'verification-2',
        status: 'CONCORDANT',
        completedAt: new Date('2026-08-20T08:00:00.000Z'),
      }),
      aVerification({
        id: 'verification-1',
        status: 'DISCORDANT',
        completedAt: new Date('2026-08-12T08:00:00.000Z'),
      }),
    ]);

    expect(annexes.map((annexe) => annexe.verdictLabel)).toEqual([
      'Vérification discordante',
      'Vérification concordante',
    ]);
  });

  it('écrit le compte supprimé sans annexe muette', () => {
    const [annexe] = annexesOf([aVerification({ verifier: null })], [anAct()]);

    expect(annexe.verifier).toBeNull();
    expect(annexe.actGroups).toEqual([]);
    expect(annexe.traces).toHaveLength(2);
  });

  it("arrête les actes d'une mission à la mission suivante du même vérificateur", () => {
    const premiere = aVerification({
      id: 'verification-1',
      status: 'DISCORDANT',
      requestedAt: new Date('2026-08-10T08:00:00.000Z'),
      completedAt: new Date('2026-08-12T08:00:00.000Z'),
    });
    const seconde = aVerification({
      id: 'verification-2',
      requestedAt: new Date('2026-08-15T08:00:00.000Z'),
      completedAt: new Date('2026-08-18T08:00:00.000Z'),
    });

    const annexes = annexesOf(
      [premiere, seconde],
      [
        anAct({ seq: 11, occurredAt: new Date('2026-08-11T09:00:00.000Z') }),
        anAct({ seq: 21, occurredAt: new Date('2026-08-16T09:00:00.000Z') }),
      ],
    );

    expect(annexes[0].actGroups[0].acts.map((act) => act.occurredAt)).toEqual([
      new Date('2026-08-11T09:00:00.000Z'),
    ]);
    expect(annexes[1].actGroups[0].acts.map((act) => act.occurredAt)).toEqual([
      new Date('2026-08-16T09:00:00.000Z'),
    ]);
  });

  it("n'écrit pas « non conclue » sur une trace retirée du dossier", () => {
    const data = caseData({
      traces: [
        piece({ id: 'trace-1', number: 1, cote: 'A' }),
        piece({
          id: 'trace-2',
          number: 2,
          cote: 'B',
          withdrawnAt: new Date('2026-08-09T08:00:00.000Z'),
        }),
      ],
      verifications: [aVerification()],
    });

    const [annexe] = buildVerificationAnnexes(
      data,
      [],
      pieceDesignations(data),
    );

    expect(annexe.traces.map((trace) => trace.traceDesignation)).toEqual([
      'la trace 3455-T1 cotée « A »',
    ]);
  });

  it('garde une trace retirée sur laquelle le vérificateur avait conclu', () => {
    const data = caseData({
      traces: [
        piece({
          id: 'trace-1',
          number: 1,
          cote: 'A',
          withdrawnAt: new Date('2026-08-13T08:00:00.000Z'),
        }),
      ],
      verifications: [aVerification()],
    });

    const [annexe] = buildVerificationAnnexes(
      data,
      [],
      pieceDesignations(data),
    );

    expect(annexe.traces).toHaveLength(1);
    expect(annexe.traces[0].resultLabel).toBe('Conclusions concordantes');
  });
});
