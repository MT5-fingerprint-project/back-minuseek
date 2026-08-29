import type {
  CaseReportData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import type {
  AnchorData,
  AuditEventData,
} from '../../ports/traceability-data.reader';
import type { ReportImageViewModel } from '../../report-view-model';
import { CaseContributorData } from '../../ports/case-contributors.reader';
import { PreviousDocumentData } from '../../ports/report-numbering.reader';
import { ServiceLetterheadData } from '../../ports/service-letterhead.reader';
import { buildTechnicalReport } from './technical-report.builder';

const OPENED_AT = new Date('2026-08-01T09:00:00.000Z');
const DECLARED_AT = new Date('2026-08-11T09:30:00.000Z');
const GENERATED_AT = new Date('2026-08-19T08:00:00.000Z');

function trace(overrides: Partial<PieceData> & { id: string }): PieceData {
  return {
    path: `media/case-1/traces/${overrides.id}.png`,
    sha256: 'a'.repeat(64),
    createdAt: OPENED_AT,
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
    origin: 'DIGITAL',
    location: 'Sur la porte-fenêtre du séjour',
    revelationTechnique: 'FINGERPRINT_POWDER',
    cote: 'A',
    notIdentifiedAt: null,
    ...overrides,
  };
}

function referencePrint(
  overrides: Partial<PieceData> & { id: string },
): PieceData {
  return trace({
    ...overrides,
    path: `media/case-1/reference-prints/${overrides.id}.png`,
    number: null,
    origin: null,
    location: null,
    revelationTechnique: null,
    cote: null,
    status: null,
  });
}

function subject(
  overrides: Partial<SubjectData> & { id: string },
): SubjectData {
  return {
    firstName: 'Samir',
    lastName: 'Sadik',
    birthDate: new Date('1979-04-02T00:00:00.000Z'),
    birthPlace: 'Paris',
    sex: 'MALE',
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
      createdAt: OPENED_AT,
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
    ...overrides,
  };
}

const LETTERHEAD: ServiceLetterheadData = {
  administration: 'Ministère de l’Intérieur',
  serviceName: 'Service Régional de Police Technique et Scientifique',
  postalAddress: '36 rue du Bastion — 75017 Paris',
  phoneNumber: '01 40 79 00 00',
  email: 'srpts-paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

const SIGNER = {
  id: 'user-aguilar',
  grade: 'Technicien en Chef de Police Technique et Scientifique',
  firstName: 'Sébastien',
  lastName: 'Aguilar',
  serviceNumber: '118 402',
};

function build(
  data: CaseReportData,
  extras: {
    chainEvents?: AuditEventData[];
    anchors?: AnchorData[];
    contributors?: CaseContributorData[];
    previousDocument?: PreviousDocumentData | null;
    letterhead?: ServiceLetterheadData;
  } = {},
) {
  return buildTechnicalReport({
    data,
    chainEvents: extras.chainEvents ?? [],
    anchors: extras.anchors ?? [],
    contributors: extras.contributors ?? [],
    signer: SIGNER,
    previousDocument: extras.previousDocument ?? null,
    letterhead: extras.letterhead ?? LETTERHEAD,
    reportId: 'report-1',
    reportNumber: '3455-R1',
    chainHead: null,
    generatedAt: GENERATED_AT,
    generatedByDisplayName: 'Alex Martin',
    images: new Map<string, ReportImageViewModel | null>(),
  });
}

describe('buildTechnicalReport — en-tête du service', () => {
  it('imprime l’en-tête du service et la ville de sa signature', () => {
    const model = build(caseData());

    expect(model.header.letterhead).toMatchObject({
      serviceName: 'Service Régional de Police Technique et Scientifique',
    });
    expect(model.header.signatureCity).toBe('Paris');
  });

  it('n’imprime aucun en-tête pour un service qui n’a rien saisi', () => {
    const model = build(caseData(), {
      letterhead: {
        administration: '',
        serviceName: '',
        postalAddress: '',
        phoneNumber: '',
        email: '',
        signatureCity: '',
      },
    });

    expect(model.header.letterhead).toBeNull();
    expect(model.header.signatureCity).toBeNull();
  });
});

describe('buildTechnicalReport — signataire, concours et filiation', () => {
  it('porte le numéro imprimé et le signataire choisi', () => {
    const model = build(caseData());

    expect(model.header.reportNumber).toBe('3455-R1');
    expect(model.signer).toEqual({
      grade: 'Technicien en Chef de Police Technique et Scientifique',
      firstName: 'Sébastien',
      lastName: 'Aguilar',
      serviceNumber: '118 402',
    });
  });

  it('ne nomme personne quand le seul auteur du dossier est le signataire', () => {
    const model = build(caseData(), {
      contributors: [
        {
          userId: 'user-aguilar',
          grade: 'Technicien en Chef de Police Technique et Scientifique',
          displayName: 'AGUILAR Sébastien',
        },
      ],
    });

    expect(model.contributors).toEqual([]);
  });

  it('nomme le signataire dès qu’un collègue a agi avec lui', () => {
    const model = build(caseData(), {
      contributors: [
        {
          userId: 'user-aguilar',
          grade: 'Technicien en Chef de Police Technique et Scientifique',
          displayName: 'AGUILAR Sébastien',
        },
        {
          userId: 'user-guichard',
          grade: 'Agent Spécialisé de Police Technique et Scientifique',
          displayName: 'GUICHARD Lucile',
        },
      ],
    });

    expect(model.contributors.map((one) => one.displayName)).toEqual([
      'AGUILAR Sébastien',
      'GUICHARD Lucile',
    ]);
  });

  it('nomme un auteur unique qui n’est pas le signataire', () => {
    const model = build(caseData(), {
      contributors: [
        {
          userId: 'user-guichard',
          grade: 'Agent Spécialisé de Police Technique et Scientifique',
          displayName: 'GUICHARD Lucile',
        },
      ],
    });

    expect(model.contributors).toHaveLength(1);
  });

  it('n’annonce aucun document antérieur sur un premier rapport', () => {
    expect(build(caseData()).previousDocument).toBeNull();
  });

  it('reprend le document antérieur tel que la numérotation le donne', () => {
    const previous = {
      number: '3455-R1',
      issuedAt: new Date('2026-03-18T10:00:00.000Z'),
    };

    expect(
      build(caseData(), { previousDocument: previous }).previousDocument,
    ).toEqual(previous);
  });
});

describe('buildTechnicalReport — cotation', () => {
  it('imprime « / » pour une trace sans cote', () => {
    const model = build(
      caseData({
        traces: [
          trace({ id: 't1', number: 1, status: 'NOT_EXPLOITABLE', cote: null }),
        ],
      }),
    );

    expect(model.exploitability[0]).toMatchObject({
      reference: '3455-T1',
      exploitability: 'INEXPLOITABLE',
      cote: '/',
    });
  });
});

describe('buildTechnicalReport — discrimination', () => {
  it('nomme la personne identifiée et la position', () => {
    const model = build(
      caseData({
        traces: [trace({ id: 't1', number: 1, cote: 'A' })],
        referencePrints: [
          referencePrint({
            id: 'r1',
            subjectId: 's1',
            position: 'RIGHT_INDEX',
          }),
        ],
        subjects: [subject({ id: 's1' })],
        declaredHits: [
          {
            traceId: 't1',
            referencePrintId: 'r1',
            declaredAt: DECLARED_AT,
            declaredBy: null,
            withdrawnAt: null,
          },
        ],
      }),
    );

    expect(model.exploitability[0].discrimination).toBe(
      'Index droit — SADIK Samir',
    );
    expect(model.identifications).toEqual([
      {
        cote: 'A',
        position: "à l'index droit",
        civility: 'Monsieur',
        firstName: 'Samir',
        lastName: 'Sadik',
      },
    ]);
  });

  it('imprime « / » pour une trace inexploitable', () => {
    const model = build(
      caseData({
        traces: [
          trace({ id: 't1', number: 1, status: 'NOT_EXPLOITABLE', cote: null }),
        ],
      }),
    );

    expect(model.exploitability[0].discrimination).toBe('/');
  });

  it('écrit NÉGATIVE sur une déclaration de non-identification', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            cote: 'A',
            notIdentifiedAt: DECLARED_AT,
          }),
        ],
      }),
    );

    expect(model.exploitability[0].discrimination).toBe('NÉGATIVE');
    expect(model.negativeCotes).toEqual(['A']);
    expect(model.notExaminedCotes).toEqual([]);
  });

  it('écrit « Non examinée », jamais NÉGATIVE, sans déclaration', () => {
    const model = build(
      caseData({ traces: [trace({ id: 't1', number: 1, cote: 'A' })] }),
    );

    expect(model.exploitability[0].discrimination).toBe('Non examinée');
    expect(model.exploitability[0].discrimination).not.toBe('NÉGATIVE');
    expect(model.notExaminedCotes).toEqual(['A']);
    expect(model.negativeCotes).toEqual([]);
  });

  it('écrit « Non examinée » même quand le dossier n’a aucune empreinte de référence', () => {
    const model = build(
      caseData({
        traces: [trace({ id: 't1', number: 1, cote: 'A' })],
        referencePrints: [],
      }),
    );

    expect(model.exploitability[0].discrimination).toBe('Non examinée');
    expect(model.negativeCotes).toEqual([]);
  });

  it('remplace cote et discrimination par la phrase de retrait', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            cote: null,
            withdrawnAt: new Date('2026-08-12T00:00:00.000Z'),
            withdrawalMotive: 'DUPLICATE',
          }),
        ],
      }),
    );

    expect(model.exploitability[0].withdrawal).toBe(
      "Retirée du dossier le 12 août 2026 — doublon d'une pièce déjà versée",
    );
    expect(model.counts.total).toBe(0);
  });
});

describe('buildTechnicalReport — réglages en clair', () => {
  it('traduit chaque calque de filtre, dans l’ordre des calques', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            layers: [
              {
                name: 'Inversion',
                type: 'FILTER',
                zIndex: 1,
                isVisible: true,
                settings: { filterKey: 'inversion', value: 1 },
              },
              {
                name: 'Saturation',
                type: 'FILTER',
                zIndex: 2,
                isVisible: true,
                settings: { filterKey: 'saturation', value: -40 },
              },
              {
                name: 'Rotation',
                type: 'FILTER',
                zIndex: 3,
                isVisible: true,
                settings: { filterKey: 'rotation', value: 12 },
              },
            ],
          }),
        ],
      }),
    );

    expect(model.imageTreatments[0].treatments).toBe(
      'Inversion, saturation −40 %, rotation 12°',
    );
  });

  it('écrit « Aucun » quand la trace ne porte aucun filtre', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            layers: [
              {
                name: 'Minutie',
                type: 'ANNOTATION',
                zIndex: 1,
                isVisible: true,
                settings: { type: 'minutiae', x: 10, y: 20 },
              },
            ],
          }),
        ],
      }),
    );

    expect(model.imageTreatments[0].treatments).toBe('Aucun');
  });

  it('passe sous silence un calque dont le réglage n’a pas de valeur chiffrée', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            layers: [
              {
                name: 'Luminosité',
                type: 'FILTER',
                zIndex: 1,
                isVisible: true,
                settings: { filterKey: 'brightness' },
              },
              {
                name: 'Contraste',
                type: 'FILTER',
                zIndex: 2,
                isVisible: true,
                settings: { filterKey: 'contrast', value: 15 },
              },
            ],
          }),
        ],
      }),
    );

    expect(model.imageTreatments[0].treatments).toBe('Contraste +15 %');
    expect(model.imageTreatments[0].treatments).not.toContain('NaN');
  });
});

describe('buildTechnicalReport — comptes de la conclusion', () => {
  it('compte exploitables, inexploitables, identifiées, négatives et non examinées', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            cote: 'A',
            notIdentifiedAt: DECLARED_AT,
          }),
          trace({ id: 't2', number: 2, cote: 'B' }),
          trace({ id: 't3', number: 3, status: 'NOT_EXPLOITABLE', cote: null }),
          trace({ id: 't4', number: 4, cote: 'C' }),
        ],
        referencePrints: [
          referencePrint({
            id: 'r1',
            subjectId: 's1',
            position: 'RIGHT_PALM',
          }),
        ],
        subjects: [subject({ id: 's1' })],
        declaredHits: [
          {
            traceId: 't2',
            referencePrintId: 'r1',
            declaredAt: DECLARED_AT,
            declaredBy: null,
            withdrawnAt: null,
          },
        ],
      }),
    );

    expect(model.counts).toEqual({
      total: 4,
      exploitable: 3,
      notExploitable: 1,
      identified: 1,
      negative: 1,
      notExamined: 1,
    });
    expect(model.negativeCotes).toEqual(['A']);
    expect(model.notExaminedCotes).toEqual(['C']);
  });
});

describe('buildTechnicalReport — emploi du comparateur', () => {
  it('est vrai dès qu’une comparaison est enregistrée', () => {
    const model = build(
      caseData({
        traces: [trace({ id: 't1', number: 1 })],
        referencePrints: [referencePrint({ id: 'r1' })],
        comparisons: [
          {
            traceId: 't1',
            referencePrintId: 'r1',
            score: 91,
            machineMatch: true,
            declaredHit: false,
            comparedAt: DECLARED_AT,
          },
        ],
      }),
    );

    expect(model.automaticComparatorUsed).toBe(true);
  });

  it('est faux sans aucune comparaison', () => {
    const model = build(caseData({ traces: [trace({ id: 't1', number: 1 })] }));

    expect(model.automaticComparatorUsed).toBe(false);
  });
});

describe('buildTechnicalReport — en-tête et personnes', () => {
  it('compose la phrase d’une victime d’après son sexe et sa date de naissance', () => {
    const model = build(
      caseData({
        subjects: [
          subject({
            id: 's1',
            firstName: 'Hélène',
            lastName: 'Berger',
            sex: 'FEMALE',
            type: 'VICTIM',
            birthDate: new Date('1958-09-04T00:00:00.000Z'),
          }),
          subject({
            id: 's2',
            firstName: 'Jean-Pierre',
            lastName: 'Le Goff',
            sex: 'MALE',
            type: 'VICTIM',
            birthDate: null,
          }),
        ],
      }),
    );

    expect(model.caseHeader.victims).toEqual([
      'Madame BERGER Hélène, née le 04/09/1958',
      'Monsieur LE GOFF Jean-Pierre',
    ]);
  });

  it('ne liste que les personnes portant une empreinte au dossier, et compte les autres empreintes', () => {
    const model = build(
      caseData({
        referencePrints: [
          referencePrint({ id: 'r1', subjectId: 's1' }),
          referencePrint({ id: 'r2', subjectId: null }),
        ],
        subjects: [
          subject({ id: 's1', type: 'CLOSE_ASSOCIATE' }),
          subject({ id: 's2' }),
        ],
      }),
    );

    expect(model.referenceSubjects).toEqual([
      {
        civility: 'Monsieur',
        firstName: 'Samir',
        lastName: 'Sadik',
        quality: 'familier',
      },
    ]);
    expect(model.unattachedReferencePrintCount).toBe(1);
  });

  it('retient la date du dernier horodatage indépendant', () => {
    const model = build(caseData(), {
      anchors: [
        {
          headSeq: 10,
          headHash: 'a'.repeat(64),
          tsaUrl: 'https://freetsa.org/tsr',
          anchoredAt: new Date('2026-08-14T03:00:00.000Z'),
          tsrSha256: 'b'.repeat(64),
        },
        {
          headSeq: 20,
          headHash: 'c'.repeat(64),
          tsaUrl: 'https://freetsa.org/tsr',
          anchoredAt: new Date('2026-08-15T03:00:00.000Z'),
          tsrSha256: 'd'.repeat(64),
        },
      ],
    });

    expect(model.independentTimestampAt).toEqual(
      new Date('2026-08-15T03:00:00.000Z'),
    );
  });

  it('n’a pas d’horodatage indépendant tant qu’aucun ancrage n’existe', () => {
    expect(build(caseData()).independentTimestampAt).toBeNull();
  });
});

describe('buildTechnicalReport — méthodes de révélation', () => {
  it('ne retient qu’une fois chaque technique employée', () => {
    const model = build(
      caseData({
        traces: [
          trace({ id: 't1', number: 1 }),
          trace({ id: 't2', number: 2 }),
          trace({ id: 't3', number: 3 }),
          trace({ id: 't4', number: 4, revelationTechnique: 'DFO' }),
          trace({ id: 't5', number: 5, revelationTechnique: 'DFO' }),
        ],
      }),
    );

    expect(model.revelationTechniques).toEqual(['FINGERPRINT_POWDER', 'DFO']);
  });

  it('les sort dans l’ordre de la séquence de traitement, pas dans celui des traces', () => {
    const model = build(
      caseData({
        traces: [
          trace({ id: 't1', number: 1, revelationTechnique: 'NINHYDRIN' }),
          trace({ id: 't2', number: 2, revelationTechnique: 'DFO' }),
          trace({
            id: 't3',
            number: 3,
            revelationTechnique: 'FINGERPRINT_POWDER',
          }),
          trace({
            id: 't4',
            number: 4,
            revelationTechnique: 'OPTICAL_PROCESS',
          }),
        ],
      }),
    );

    expect(model.revelationTechniques).toEqual([
      'OPTICAL_PROCESS',
      'FINGERPRINT_POWDER',
      'DFO',
      'NINHYDRIN',
    ]);
  });

  it('décrit aussi la technique d’une trace retirée, que la section 3 imprime encore', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            revelationTechnique: 'NINHYDRIN',
            withdrawnAt: new Date('2026-08-12T10:00:00.000Z'),
            withdrawalMotive: 'MISFILED',
          }),
        ],
      }),
    );

    expect(model.revelationTechniques).toEqual(['NINHYDRIN']);
  });

  it('ne retient rien quand aucune trace ne porte de technique', () => {
    const model = build(
      caseData({
        traces: [trace({ id: 't1', number: 1, revelationTechnique: null })],
      }),
    );

    expect(model.revelationTechniques).toEqual([]);
  });
});

describe('buildTechnicalReport — traces examinées', () => {
  it('regroupe les traces consécutives de même description', () => {
    const model = build(
      caseData({
        traces: [
          trace({ id: 't1', number: 1 }),
          trace({ id: 't2', number: 2 }),
          trace({ id: 't3', number: 3, location: 'Sur le coffre-fort' }),
        ],
      }),
    );

    expect(model.examinedTraces).toEqual([
      {
        label: '3455-T1 et T2',
        origin: 'Digitale',
        location: 'Sur la porte-fenêtre du séjour',
        revelationTechnique: 'Poudre dactyloscopique',
      },
      {
        label: '3455-T3',
        origin: 'Digitale',
        location: 'Sur le coffre-fort',
        revelationTechnique: 'Poudre dactyloscopique',
      },
    ]);
  });

  it('dit qu’une description manque plutôt que d’imprimer un trou', () => {
    const model = build(
      caseData({
        traces: [
          trace({
            id: 't1',
            number: 1,
            origin: null,
            location: null,
            revelationTechnique: null,
          }),
        ],
      }),
    );

    expect(model.examinedTraces[0]).toMatchObject({
      origin: 'Non renseignée',
      location: 'Non renseignée',
      revelationTechnique: 'Non renseignée',
    });
  });
});
