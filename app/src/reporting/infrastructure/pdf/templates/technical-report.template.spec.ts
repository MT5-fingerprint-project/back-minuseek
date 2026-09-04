import {
  ReportDemonstrationViewModel,
  TechnicalReportViewModel,
} from '../../../application/report-view-model';
import { renderTechnicalReportHtml } from './technical-report.template';

const IMAGE = {
  dataUrl: 'data:image/png;base64,AAA',
  width: 800,
  height: 1200,
  observedSha256: null,
  lifeSizeMm: null,
};

function demonstration(
  overrides: Partial<ReportDemonstrationViewModel> = {},
): ReportDemonstrationViewModel {
  return {
    reference: '3455-T2',
    cote: 'B',
    location: 'sur la porte-fenêtre du séjour',
    subject: { civility: 'Madame', firstName: 'Hélène', lastName: 'Berger' },
    position: 'index droit',
    rawTrace: null,
    trace: { image: IMAGE, marks: [] },
    referencePrint: { image: IMAGE, marks: [] },
    ...overrides,
  };
}

function model(
  overrides: Partial<TechnicalReportViewModel> = {},
): TechnicalReportViewModel {
  return {
    kind: 'TECHNICAL',
    header: {
      reportId: 'report-1',
      reportNumber: '3455-R1',
      chainHeadSeq: 42,
      chainHeadHash: 'c'.repeat(64),
      caseNumber: '3455',
      pvNumber: 'PV-2026-001',
      caseStatus: 'OPEN',
      openedAt: new Date('2026-08-01T09:00:00.000Z'),
      generatedAt: new Date('2026-08-19T08:00:00.000Z'),
      generatedByDisplayName: 'Alex Martin',
      letterhead: {
        administration: 'Ministère de l’Intérieur',
        serviceName: 'Service Régional de Police Technique et Scientifique',
        postalAddress: '36 rue du Bastion — 75017 Paris',
        phoneNumber: '01 40 79 00 00',
        email: 'srpts-paris@interieur.gouv.fr',
      },
      signatureCity: 'Paris',
    },
    saisine: null,
    caseHeader: {
      caseNumber: '3455',
      pvNumber: 'PV-2026-001',
      requestDate: new Date('2026-03-14T00:00:00.000Z'),
      requesterQuality: 'Brigadier-Chef de Police',
      requesterName: 'MARCHAND Claire',
      requesterService: '3e District de Police Judiciaire',
      offenseNature: 'Vol par effraction',
      offenseLocation: '12 rue Léon Frot à Paris 11e',
      offenseDateFrom: new Date('2026-03-13T00:00:00.000Z'),
      offenseDateTo: null,
      interventionDate: new Date('2026-03-14T00:00:00.000Z'),
      caseAgainst: 'X',
      description: null,
      victims: ['Madame BERGER Hélène, née le 04/09/1958'],
      recipient: {
        authority: 'Le Commissaire Général',
        attention: 'Brigadier-Chef de Police MARCHAND Claire',
      },
    },
    revelationTechniques: ['FINGERPRINT_POWDER'],
    previousDocument: null,
    signer: {
      grade: 'Technicien en Chef de Police Technique et Scientifique',
      firstName: 'Sébastien',
      lastName: 'Aguilar',
      serviceNumber: '118 402',
    },
    contributors: [],
    withdrawnElements: [],
    examinedTraces: [
      {
        label: '3455-T1 et T2',
        origin: 'Digitale',
        location: 'Sur la porte-fenêtre du séjour',
        revelationTechnique: 'Poudre dactyloscopique',
      },
    ],
    exploitability: [
      {
        reference: '3455-T1',
        exploitability: 'EXPLOITABLE',
        cote: 'A',
        discrimination: 'Index droit — SADIK Samir',
      },
      {
        reference: '3455-T2',
        exploitability: 'EXPLOITABLE',
        cote: 'B',
        discrimination: 'Non examinée',
      },
    ],
    referenceSubjects: [
      {
        civility: 'Monsieur',
        firstName: 'Samir',
        lastName: 'Sadik',
        quality: 'mis en cause',
      },
    ],
    unattachedReferencePrintCount: 0,
    automaticComparatorUsed: false,
    personOfInterestPrintCount: 1,
    comparisons: [
      {
        reference: '3455-T1',
        cote: 'A',
        result: "À l'index droit — SADIK Samir",
      },
      { reference: '3455-T2', cote: 'B', result: 'Non examinée' },
    ],
    identifications: [
      {
        cote: 'A',
        position: "à l'index droit",
        subject: {
          civility: 'Monsieur',
          firstName: 'Samir',
          lastName: 'Sadik',
          sex: 'MALE',
          birthDate: null,
          birthPlace: null,
        },
      },
    ],
    negativeCotes: [],
    notExaminedCotes: ['B'],
    independentTimestampAt: new Date('2026-03-15T03:00:00.000Z'),
    counts: {
      total: 2,
      exploitable: 2,
      notExploitable: 0,
      identified: 1,
      negative: 0,
      notExamined: 1,
      discriminated: 0,
    },
    traces: [],
    referencePrints: [],
    identityDemonstrations: [],
    annexA: [],
    annexB: [],
    integrity: {
      traces: [],
      referencePrints: [],
      lastAnchor: null,
      recordVerifiedAtEdition: true,
      firstBrokenEntryNumber: null,
      anchorsFailed: 0,
      verificationUrl: 'https://minuseek.fr/srpts-paris/verification',
    },
    journal: {
      detail: 'SUMMARY',
      acts: [],
      summaries: [],
      actCountTotal: 0,
      actCountPrinted: 0,
    },
    verifications: [],
    ...overrides,
  };
}

const SECTION_TITLES = [
  '1. Saisine',
  '2. Objet et pièces examinées',
  '3. Méthodes et techniques employées',
  '4. Traces papillaires examinées',
  '5. Exploitabilité et cotation',
  '6. Comparaisons et identifications',
  '7. Traitements appliqués aux images et intégrité des pièces',
  '8. Conclusion',
];

describe('renderTechnicalReportHtml — structure', () => {
  it('sort les huit sections dans l’ordre', () => {
    const html = renderTechnicalReportHtml(model());
    const positions = SECTION_TITLES.map((title) => html.indexOf(title));

    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('imprime le titre, le sous-titre et le pied de page', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain("RAPPORT D'EXPLOITATION DE TRACES PAPILLAIRES");
    expect(html).toContain(
      "Examen dactyloscopique, comparaison et démonstration d'identité",
    );
    expect(html).toContain(
      'Toute reproduction partielle du rapport et des annexes est interdite.',
    );
  });

  it('annonce les trois annexes et garde le journal en annexe C', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [demonstration()],
        annexA: [
          {
            reference: '3455-T1',
            cote: 'A',
            location: null,
            locationPhoto: null,
            trace: null,
            sealedAt: new Date('2026-08-16T17:03:00.000Z'),
          },
        ],
      }),
    );

    expect(html).toContain('Annexe A — Localisation des traces papillaires');
    expect(html).toContain("Annexe B — Démonstrations d'identité");
    expect(html).toContain('Annexe C — Journal des actes');
  });

  it('ne code aucun numéro de page dans le sommaire', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).not.toMatch(/page\s*\d/i);
    expect(html).not.toContain('counter(page)');
  });
});

describe('renderTechnicalReportHtml — ce qui ne doit jamais sortir', () => {
  it('n’imprime ni score, ni coordonnée, ni JSON brut', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html.toLowerCase()).not.toContain('score');
    expect(html).not.toContain('<pre>');
    expect(html).not.toContain('Score d’exploitabilité');
  });

  it('ne réintroduit pas le bloc « VU ET TRANSMIS »', () => {
    expect(renderTechnicalReportHtml(model())).not.toContain('VU ET TRANSMIS');
  });

  it('échappe le texte libre venu de la base', () => {
    const html = renderTechnicalReportHtml(
      model({
        examinedTraces: [
          {
            label: '3455-T1',
            origin: 'Digitale',
            location: '<script>alert(1)</script>',
            revelationTechnique: 'DFO',
          },
        ],
      }),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

describe('renderTechnicalReportHtml — méthodes et techniques employées', () => {
  it('ne décrit pas une technique qui n’a pas servi', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain('Révélation par poudre dactyloscopique');
    expect(html.toLowerCase()).not.toContain('ninhydrine');
    expect(html).not.toContain('DFO');
  });

  it('décrit le DFO avant la ninhydrine, comme il s’emploie', () => {
    const html = renderTechnicalReportHtml(
      model({ revelationTechniques: ['DFO', 'NINHYDRIN'] }),
    );

    expect(html.indexOf('Révélation au DFO')).toBeLessThan(
      html.indexOf('Révélation à la ninhydrine'),
    );
  });

  it('le dit quand aucune technique n’est enregistrée', () => {
    const html = renderTechnicalReportHtml(model({ revelationTechniques: [] }));

    expect(html).toContain(
      "Aucune technique de révélation n'est enregistrée pour les traces de ce dossier.",
    );
    expect(html).not.toContain(
      'Les techniques décrites ci-dessous sont celles effectivement employées',
    );
  });

  it('passe une technique qu’il ne sait pas décrire plutôt que d’imprimer un trou', () => {
    const html = renderTechnicalReportHtml(
      model({ revelationTechniques: ['FINGERPRINT_POWDER', 'CYANOACRYLATE'] }),
    );

    expect(html).toContain('Révélation par poudre dactyloscopique');
    expect(html).not.toContain('undefined');
  });
});

describe('renderTechnicalReportHtml — le comparateur automatique', () => {
  it('imprime le paragraphe quand le comparateur a été employé', () => {
    const html = renderTechnicalReportHtml(
      model({ automaticComparatorUsed: true }),
    );

    expect(html.replace(/\s+/g, ' ')).toContain(
      'Le comparateur automatique de la plateforme a été employé dans le cadre de la présente affaire.',
    );
    expect(html.replace(/\s+/g, ' ')).toContain(
      "l'examen comparatif et la conclusion d'identité relèvent exclusivement de l'expert signataire",
    );
  });

  it('ne l’imprime pas quand il ne l’a pas été', () => {
    const html = renderTechnicalReportHtml(
      model({ automaticComparatorUsed: false }),
    );

    expect(html).not.toContain('Le comparateur automatique de la plateforme');
  });
});

describe('renderTechnicalReportHtml — les conclusions', () => {
  it('écrit les identifications avec la règle des douze points', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain(
      'la trace papillaire cotée <b>« A »</b> est identifiée',
    );
    expect(html).toContain(
      'au moins DOUZE (12) minuties concordantes, sans aucune discordance inexplicable',
    );
  });

  it('distingue une trace déclarée négative d’une trace non examinée', () => {
    const html = renderTechnicalReportHtml(
      model({
        negativeCotes: ['C'],
        notExaminedCotes: ['F'],
        counts: { ...model().counts, negative: 1, notExamined: 1 },
      }),
    );

    const flat = html.replace(/\s+/g, ' ');

    expect(flat).toContain('non identifiée, cotée « C »');
    expect(flat).toContain('non encore examinée, cotée « F »');
  });

  it('ouvre une section pour les éléments retirés, avant les traces examinées', () => {
    const html = renderTechnicalReportHtml(
      model({
        withdrawnElements: [
          {
            designation: 'la trace 3455-T1',
            withdrawnAt: new Date('2026-08-12T00:00:00.000Z'),
            motiveLabel: "doublon d'une pièce déjà versée",
            imageDestroyed: false,
          },
        ],
      }),
    );

    expect(html).toContain('<h2>4. Éléments retirés du dossier</h2>');
    expect(html).toContain('<li>4. Éléments retirés du dossier</li>');
    expect(html).toContain('<h2>5. Traces papillaires examinées</h2>');
    expect(html).toContain('La trace 3455-T1');
    expect(html).toContain('doublon d&#39;une pièce déjà versée');
    expect(html).toContain('ne sont pas délivrées avec le présent rapport');
  });

  it('n’ouvre pas la section quand aucun élément n’a été retiré', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).not.toContain('Éléments retirés du dossier');
    expect(html).toContain('<h2>4. Traces papillaires examinées</h2>');
  });

  it('dit qu’une image détruite ne peut plus être communiquée', () => {
    const html = renderTechnicalReportHtml(
      model({
        withdrawnElements: [
          {
            designation: "l'empreinte de l'index droit de Monsieur SADIK Samir",
            withdrawnAt: new Date('2026-08-12T00:00:00.000Z'),
            motiveLabel: 'rattachement erroné à une personne ou à un doigt',
            imageDestroyed: true,
          },
        ],
      }),
    );

    expect(html).toContain(
      'a été détruite : elle ne peut plus être communiquée',
    );
  });

  it('renvoie le lecteur à l’annexe C pour le détail acte par acte', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain('Le détail acte par acte figure en Annexe C.');
  });
});

describe('renderTechnicalReportHtml — les mentions du tableau de comparaison', () => {
  function withResults(...results: string[]) {
    return renderTechnicalReportHtml(
      model({
        comparisons: results.map((result, order) => ({
          reference: `3455-T${order + 1}`,
          cote: String.fromCharCode(65 + order),
          result,
        })),
      }),
    );
  }

  it('n’explique la mention « NÉGATIVE » que si une trace la porte', () => {
    const html = withResults('NÉGATIVE');

    expect(html).toContain('La mention « NÉGATIVE » indique');
    expect(html).not.toContain('La mention « non examinée » indique');
  });

  it('n’explique la mention « non examinée » que si une trace la porte', () => {
    const html = withResults('Non examinée');

    expect(html).toContain('La mention « non examinée » indique');
    expect(html).not.toContain('La mention « NÉGATIVE » indique');
  });

  it('explique les deux mentions quand les deux figurent au tableau', () => {
    const html = withResults('NÉGATIVE', 'Non examinée');

    expect(html).toContain('La mention « NÉGATIVE » indique');
    expect(html).toContain('La mention « non examinée » indique');
  });

  it('n’explique rien quand aucune des deux mentions ne figure au tableau', () => {
    const html = withResults('Index droit — SADIK Samir');

    expect(html).not.toContain('La mention « NÉGATIVE » indique');
    expect(html).not.toContain('La mention « non examinée » indique');
  });

  it('rapporte la mention NÉGATIVE aux seules empreintes des mis en cause', () => {
    expect(withResults('NÉGATIVE')).toContain(
      "des personnes mises en cause et a déclaré n'y relever",
    );
  });
});

describe('renderTechnicalReportHtml — numéro, filiation et signature', () => {
  it('imprime le numéro du rapport dans le bloc Références', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain('Rapport n°</span> : 3455-R1');
  });

  it('dit qu’un rapport sans antérieur est le premier du dossier', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain(
      'Le présent rapport est le premier établi sur ce dossier.',
    );
  });

  it('annonce le document auquel il succède', () => {
    const html = renderTechnicalReportHtml(
      model({
        previousDocument: {
          number: '3455-R1',
          issuedAt: new Date('2026-03-18T10:00:00.000Z'),
        },
      }),
    );

    expect(html).toContain(
      'Le présent rapport succède au rapport 3455-R1, établi le 18/03/2026.',
    );
    expect(html).not.toContain(
      'Le présent rapport est le premier établi sur ce dossier.',
    );
  });

  it('imprime le grade, le nom et le matricule du signataire', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain(
      'Technicien en Chef de Police Technique et Scientifique',
    );
    expect(html).toContain('AGUILAR Sébastien — Matricule 118 402');
    expect(html).toContain('Fait à Paris, le 19/08/2026');
  });

  it('porte le numéro du rapport en pied de page', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain(
      'Toute reproduction partielle du rapport et des annexes est interdite. Rapport 3455-R1.',
    );
  });

  it('n’imprime plus l’identifiant technique du rapport', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).not.toContain('report-1');
  });

  it('ne nomme personne quand personne d’autre que le signataire n’a agi', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).not.toContain('Ont concouru à ces opérations');
  });

  it('accorde l’article au grade : « le Technicien », « l’Agent »', () => {
    const html = renderTechnicalReportHtml(
      model({
        contributors: [
          {
            grade: 'Technicien en Chef de Police Technique et Scientifique',
            displayName: 'AGUILAR Sébastien',
          },
          {
            grade: 'Agent Spécialisé de Police Technique et Scientifique',
            displayName: 'GUICHARD Lucile',
          },
        ],
      }),
    );

    expect(html).toContain(
      'Ont concouru à ces opérations : le Technicien en Chef de Police Technique et Scientifique AGUILAR Sébastien, l&#39;Agent Spécialisé de Police Technique et Scientifique GUICHARD Lucile.',
    );
  });

  it('nomme sans grade un auteur que l’annuaire ne connaît pas', () => {
    const html = renderTechnicalReportHtml(
      model({
        contributors: [{ grade: null, displayName: 'Sébastien Aguilar' }],
      }),
    );

    expect(html).toContain(
      'Ont concouru à ces opérations : Sébastien Aguilar.',
    );
  });
});

describe('renderTechnicalReportHtml — en-tête du service', () => {
  it('imprime les lignes du service en tête du document', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain('Ministère de l’Intérieur');
    expect(html).toContain(
      'Service Régional de Police Technique et Scientifique',
    );
    expect(html).toContain('36 rue du Bastion — 75017 Paris');
    expect(html).toContain('01 40 79 00 00 — srpts-paris@interieur.gouv.fr');
  });

  it('place l’en-tête avant le titre du rapport', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html.indexOf('class="lettre"')).toBeLessThan(
      html.indexOf("RAPPORT D'EXPLOITATION DE TRACES PAPILLAIRES"),
    );
  });

  it('ne laisse aucun cadre quand le service n’a rien saisi', () => {
    const html = renderTechnicalReportHtml(
      model({
        header: { ...model().header, letterhead: null, signatureCity: null },
      }),
    );

    expect(html).not.toContain('class="lettre"');
    expect(html).toContain('Fait le 19/08/2026');
    expect(html).not.toContain('Fait à');
  });

  it('n’imprime que les lignes renseignées d’un en-tête partiel', () => {
    const html = renderTechnicalReportHtml(
      model({
        header: {
          ...model().header,
          letterhead: {
            administration: null,
            serviceName: 'S.R.P.T.S. de Paris',
            postalAddress: null,
            phoneNumber: null,
            email: null,
          },
        },
      }),
    );

    expect(html).toContain('S.R.P.T.S. de Paris');
    expect(html).not.toContain('<b></b>');
    expect(html).not.toContain('undefined');
  });
});

const JOURNAL_ACT = {
  order: 1,
  occurredAt: new Date('2026-03-16T16:00:00.000Z'),
  actorDisplayName: 'Sébastien Aguilar',
  sentence: 'Dépôt de la trace 3455-T2 cotée « B » et mise sous scellé',
};

describe('renderTechnicalReportHtml — annexe C', () => {
  function journal(overrides: Record<string, unknown> = {}) {
    return model({
      journal: {
        detail: 'SUMMARY',
        acts: [JOURNAL_ACT],
        summaries: [],
        actCountTotal: 1,
        actCountPrinted: 1,
        ...overrides,
      },
    } as never);
  }

  it('titre l’annexe et annonce le filtrage des saisies administratives', () => {
    const html = renderTechnicalReportHtml(journal());

    expect(html).toContain('Annexe C — Journal des actes');
    expect(html).toContain(
      "Chronologie des actes enregistrés sur le dossier 3455, dans l'ordre où ils ont été accomplis.",
    );
    expect(html).toContain(
      "Les actes de saisie administrative — corrections d'en-tête, réglages du service — ne sont pas repris dans la présente chronologie.",
    );
  });

  it('annonce le regroupement en variante résumée', () => {
    const html = renderTechnicalReportHtml(journal());

    expect(html).toContain(
      'sont résumés par une ligne par trace. Une version détaillée de la présente annexe, qui les énumère un par un, peut être éditée sur demande.',
    );
    expect(html).not.toContain('Version détaillée :');
  });

  it('annonce l’énumération en variante détaillée, sans prétendre tout imprimer', () => {
    const html = renderTechnicalReportHtml(journal({ detail: 'FULL' }));

    expect(html).toContain(
      "Version détaillée : chaque réglage d'amélioration figure ci-dessous, un par un, sans regroupement.",
    );
    expect(html).not.toContain(
      'tous les actes enregistrés figurent ci-dessous',
    );
  });

  it('imprime la phrase de l’acte, son heure et son auteur', () => {
    const html = renderTechnicalReportHtml(journal());

    expect(html).toContain(
      'Dépôt de la trace 3455-T2 cotée « B » et mise sous scellé',
    );
    expect(html).toContain('16/03/2026 à 16 h 00');
    expect(html).toContain('Sébastien Aguilar');
  });

  it('résume les réglages d’une trace en une ligne bornée dans le temps', () => {
    const html = renderTechnicalReportHtml(
      journal({
        acts: [],
        summaries: [
          {
            family: 'ADJUSTMENT',
            pieceDesignation: 'la trace 3455-T2 cotée « B »',
            count: 13,
            firstAt: new Date('2026-03-16T17:03:00.000Z'),
            lastAt: new Date('2026-03-16T17:41:00.000Z'),
          },
        ],
        actCountTotal: 13,
        actCountPrinted: 1,
      }),
    );

    expect(html).toContain(
      "13 réglages d'amélioration d'image sur la trace 3455-T2 cotée « B », entre 17 h 03 et 17 h 41",
    );
  });

  it('accorde la ligne de synthèse au singulier', () => {
    const html = renderTechnicalReportHtml(
      journal({
        acts: [],
        summaries: [
          {
            family: 'ADJUSTMENT',
            pieceDesignation: 'la trace 3455-T2 cotée « B »',
            count: 1,
            firstAt: new Date('2026-03-16T17:03:00.000Z'),
            lastAt: new Date('2026-03-16T17:03:00.000Z'),
          },
        ],
        actCountTotal: 1,
        actCountPrinted: 1,
      }),
    );

    expect(html).toContain("1 réglage d'amélioration d'image sur");
  });

  it('résume les minuties relevées sur une trace', () => {
    const html = renderTechnicalReportHtml(
      journal({
        acts: [],
        summaries: [
          {
            family: 'MARK',
            pieceDesignation: 'la trace 3455-T2 cotée « B »',
            count: 12,
            firstAt: new Date('2026-03-16T17:12:00.000Z'),
            lastAt: new Date('2026-03-16T17:19:00.000Z'),
          },
        ],
        actCountTotal: 12,
        actCountPrinted: 1,
      }),
    );

    expect(html).toContain(
      '12 minuties relevées sur la trace 3455-T2 cotée « B », entre 17 h 12 et 17 h 19',
    );
  });

  it('dit l’écart entre ce que le registre porte et ce que l’annexe affiche', () => {
    const html = renderTechnicalReportHtml(
      journal({ actCountTotal: 120, actCountPrinted: 40 }),
    );

    expect(html).toContain(
      'Le registre de ce dossier porte 120 inscriptions, restituées ici en 40 lignes.',
    );
    expect(html).not.toContain('en détaille');
  });

  it('ne sort ni empreinte, ni numéro d’inscription, ni nom technique d’événement', () => {
    const html = renderTechnicalReportHtml(journal());

    expect(html).not.toContain('LAYER_');
    expect(html).not.toContain('filterKey');
    expect(html).not.toContain('engineVersion');
    expect(html).not.toContain('matchThreshold');
    expect(html).not.toContain('prevHash');
    expect(html).not.toContain('sha256');
    expect(html).not.toContain('Maillon');
    expect(html).not.toContain('Empreinte (début)');
  });

  it('ne comporte que quatre colonnes', () => {
    const html = renderTechnicalReportHtml(journal());

    expect(html).toContain(
      '<tr><th>N°</th><th>Date et heure</th><th>Auteur</th><th>Acte</th></tr>',
    );
  });
});

const SEALED = 'a'.repeat(64);

const PIECE_INTEGRITY = {
  designation: 'la trace 3455-T2 cotée « B »',
  cote: 'B',
  recordedSha256: SEALED,
  sealedAt: new Date('2026-03-16T17:03:00.000Z'),
  recordEntryNumber: 12,
  currentRowSha256: SEALED,
  divergesFromRecord: false,
  servedFileIsDerived: false,
  observedSha256: SEALED,
  observedMatchesRecord: true,
  treatments: [
    {
      sentence: 'Luminosité portée à +20 %',
      appliedAt: new Date('2026-03-16T17:10:00.000Z'),
      actorDisplayName: 'Sébastien Aguilar',
      removedAt: null,
      hiddenAtEdition: false,
    },
  ],
  lastActEntryNumber: 30,
  coveringAnchor: {
    anchoredAt: new Date('2026-03-17T02:00:00.000Z'),
    authority: 'https://freetsa.org/tsr',
    entryNumber: 40,
  },
};

function withIntegrity(overrides: Record<string, unknown> = {}) {
  return model({
    integrity: {
      traces: [PIECE_INTEGRITY],
      referencePrints: [],
      lastAnchor: {
        anchoredAt: new Date('2026-03-17T02:00:00.000Z'),
        entryNumber: 40,
      },
      recordVerifiedAtEdition: true,
      firstBrokenEntryNumber: null,
      anchorsFailed: 0,
      verificationUrl: 'https://minuseek.fr/srpts-paris/verification',
      ...overrides,
    },
  });
}

describe('renderTechnicalReportHtml — section 7', () => {
  it('imprime le préambule d’intégrité', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain(
      'son empreinte numérique est inscrite au registre chronologique du laboratoire dans la même opération indivisible',
    );
    expect(html).toContain(
      "Le logiciel ne comporte aucune fonction permettant de remplacer le fichier d'une pièce.",
    );
    expect(html).toContain('Le registre chronologique est en écriture seule');
  });

  it('imprime l’empreinte du registre et sa date de mise sous scellé', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain(`<span class="hash">${SEALED}</span>`);
    expect(html).toContain(
      'Mise sous scellé le 16/03/2026 à 17 h 03, inscription n° 12 du registre.',
    );
  });

  it('imprime celle du registre, pas celle de la fiche, quand elles divergent', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [
          {
            ...PIECE_INTEGRITY,
            currentRowSha256: 'b'.repeat(64),
            divergesFromRecord: true,
          },
        ],
      }),
    );

    expect(html).toContain(`<span class="hash">${SEALED}</span>`);
    expect(html).not.toContain('b'.repeat(64));
    expect(html).toContain(
      'cette divergence doit être signalée au responsable du laboratoire',
    );
  });

  it('dit qu’une pièce sans inscription de dépôt n’est pas attestée', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [
          {
            ...PIECE_INTEGRITY,
            recordedSha256: null,
            sealedAt: null,
            recordEntryNumber: null,
          },
        ],
      }),
    );

    expect(html).toContain(
      "Aucune empreinte n'a été inscrite au registre lors du dépôt de cette pièce.",
    );
  });

  it('range les traitements dans un tableau, avec leur date et leur auteur', () => {
    const html = renderTechnicalReportHtml(withIntegrity());
    const flat = html.replace(/\s+/g, ' ');

    expect(flat).toContain('<p>Traitements enregistrés :</p>');
    expect(flat).toContain(
      '<th>Traitement</th><th style="width:20%">Posé le</th> <th style="width:20%">Par</th><th style="width:28%">État à l\'édition</th>',
    );
    expect(flat).toContain(
      '<td>Luminosité portée à +20 %</td> <td>16/03/2026 à 17 h 10</td> <td>Sébastien Aguilar</td> <td>Toujours posé</td>',
    );
    expect(flat).toContain(
      "Ces traitements sont des réglages d'affichage ; ils n'ont pas modifié le fichier scellé ci-dessus.",
    );
  });

  it('imprime la date du retrait dans la colonne d’état', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [
          {
            ...PIECE_INTEGRITY,
            treatments: [
              {
                ...PIECE_INTEGRITY.treatments[0],
                removedAt: new Date('2026-03-16T17:40:00.000Z'),
              },
            ],
          },
        ],
      }),
    );

    expect(html).toContain('<td>Retiré le 16/03/2026 à 17 h 40</td>');
  });

  it('dit qu’un réglage était masqué à l’édition du rapport', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [
          {
            ...PIECE_INTEGRITY,
            treatments: [
              { ...PIECE_INTEGRITY.treatments[0], hiddenAtEdition: true },
            ],
          },
        ],
      }),
    );

    expect(html).toContain('<td>Masqué</td>');
  });

  it('le dit quand aucun traitement n’a été appliqué', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({ traces: [{ ...PIECE_INTEGRITY, treatments: [] }] }),
    );

    expect(html).toContain("Aucun traitement n'a été appliqué à cette image.");
  });

  it('nomme l’autorité et la date de l’ancre couvrante', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain(
      "l'autorité d'horodatage https://freetsa.org/tsr a daté un état du registre postérieur à ces opérations (inscription n° 40)",
    );
  });

  it('ne dit rien quand aucune ancre ne couvre les actes', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [{ ...PIECE_INTEGRITY, coveringAnchor: null }],
        lastAnchor: {
          anchoredAt: new Date('2026-03-16T10:00:00.000Z'),
          entryNumber: 10,
        },
      }),
    );

    expect(html).not.toContain('Aucun horodatage extérieur');
    expect(html).not.toContain('ne sont attestées que par');
  });

  it('ne dit rien quand le laboratoire n’a jamais été horodaté', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [{ ...PIECE_INTEGRITY, coveringAnchor: null }],
        lastAnchor: null,
      }),
    );

    expect(html).not.toContain('Aucun horodatage extérieur');
    expect(html).not.toContain('pas encore été horodaté');
  });

  it('affirme le contrôle quand le fichier porte bien l’empreinte inscrite', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain(
      "le fichier conservé porte bien l'empreinte inscrite au registre",
    );
  });

  it('dénonce une pièce dont le fichier ne porte plus l’empreinte inscrite', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [{ ...PIECE_INTEGRITY, observedMatchesRecord: false }],
      }),
    );

    expect(html).toContain(
      "Cette pièce doit être tenue pour altérée jusqu'à examen.",
    );
  });

  it('n’affirme aucun contrôle quand le fichier n’a pas pu être relu', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [
          {
            ...PIECE_INTEGRITY,
            observedSha256: null,
            observedMatchesRecord: null,
          },
        ],
      }),
    );

    expect(html).not.toContain("Le fichier n'a pas pu être relu");
    expect(html).not.toContain("le contrôle n'a pas été effectué");
    expect(html).not.toContain(
      "le fichier conservé porte bien l'empreinte inscrite au registre",
    );
  });

  it('n’affirme aucun contrôle sur un fichier dérivé, et dit pourquoi', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        traces: [
          {
            ...PIECE_INTEGRITY,
            servedFileIsDerived: true,
            observedMatchesRecord: null,
          },
        ],
      }),
    );

    expect(html).toContain(
      "L'image reproduite dans le présent rapport n'est pas le fichier reçu",
    );
    expect(html).not.toContain("le contrôle n'a pas été effectué.");
  });

  it('imprime l’encadré d’anomalie quand le registre n’est pas vérifié', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        recordVerifiedAtEdition: false,
        firstBrokenEntryNumber: 17,
      }),
    );

    expect(html).toContain("a relevé une anomalie à l'inscription n° 17");
  });

  it('imprime l’encadré des horodatages quand seuls ceux-ci sont en cause', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({ recordVerifiedAtEdition: false, anchorsFailed: 2 }),
    );

    expect(html).toContain("n'a pas pu valider 2 horodatage(s) extérieur(s)");
  });

  it('imprime l’adresse de vérification et ce qu’elle signale', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain('https://minuseek.fr/srpts-paris/verification');
    expect(html).toContain(
      'la page indique en outre si une version antérieure et si une version ultérieure de ce rapport ont été établies',
    );
    expect(html).toContain('le fichier ne quitte pas son poste');
  });

  it('borne la portée de ce que la section établit', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain(
      "Cela n'établit ni la qualité de la prise de vue, ni l'origine de l'image avant son dépôt au laboratoire.",
    );
  });

  it('ne sort ni nom de champ, ni chemin de stockage, ni vocabulaire d’ingénieur', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).not.toContain('payload');
    expect(html).not.toContain('storagePath');
    expect(html).not.toContain('fingerprintId');
    expect(html).not.toContain('filterKey');
    expect(html).not.toContain('prevHash');
    expect(html.toLowerCase()).not.toContain('maillon');
    expect(html).not.toContain('media/');
  });

  it('écrit en annexe C que le registre a été vérifié à l’édition', () => {
    const html = renderTechnicalReportHtml(withIntegrity());

    expect(html).toContain(
      "L'intégrité du registre a été vérifiée à l'édition du présent rapport : aucune anomalie relevée.",
    );
    expect(html).toContain(
      'Le dernier horodatage extérieur du registre date du 17/03/2026 à 02 h 00.',
    );
  });

  it('écrit en annexe C l’anomalie relevée, plutôt qu’un blanc-seing', () => {
    const html = renderTechnicalReportHtml(
      withIntegrity({
        recordVerifiedAtEdition: false,
        firstBrokenEntryNumber: 17,
      }),
    );

    expect(html).toContain("une anomalie a été relevée à l'inscription n° 17.");
    expect(html).not.toContain('aucune anomalie relevée.');
  });
});

const PLATE = {
  reference: '3455-T1',
  cote: 'A',
  location: 'sur la face extérieure de la porte-fenêtre du séjour',
  locationPhoto: {
    dataUrl: 'data:image/png;base64,AAA',
    width: 800,
    height: 1200,
    observedSha256: null,
    lifeSizeMm: null,
  },
  trace: {
    dataUrl: 'data:image/png;base64,BBB',
    width: 4496,
    height: 3000,
    observedSha256: null,
    lifeSizeMm: { width: 32.13, height: 21.44 },
  },
  sealedAt: new Date('2026-08-16T17:03:00.000Z'),
};

describe('renderTechnicalReportHtml — séparation des annexes', () => {
  it('ouvre l’annexe C sur sa propre page de titre, comme les autres annexes', () => {
    const html = renderTechnicalReportHtml(
      model({ annexA: [PLATE], annexB: [demonstration()] }),
    );

    const titles = [
      ...html.matchAll(/<div class="annexe-titre">\s*<h2>([^<]+)</g),
    ].map((match) => match[1]);
    expect(titles).toEqual([
      'Annexe A — Localisation des traces papillaires',
      'Annexe B — Démonstrations d&#39;identité',
      'Annexe C — Journal des actes',
    ]);
  });

  it('rappelle le dossier et le procès-verbal sur la page de titre de l’annexe C', () => {
    const html = renderTechnicalReportHtml(model());

    const opening = html.slice(
      html.indexOf('Annexe C — Journal des actes') - 400,
    );
    expect(opening).toContain('Dossier 3455 — procès-verbal PV-2026-001');
  });
});

describe('renderTechnicalReportHtml — annexe A', () => {
  it('ouvre l’annexe par sa page de titre, dossier et procès-verbal', () => {
    const html = renderTechnicalReportHtml(model({ annexA: [PLATE] }));

    expect(html).toContain('Annexe A — Localisation des traces papillaires');
    expect(html).toContain('Dossier 3455 — procès-verbal PV-2026-001');
  });

  it('numérote les planches en chiffres romains', () => {
    const html = renderTechnicalReportHtml(
      model({ annexA: [PLATE, { ...PLATE, reference: '3455-T2', cote: 'B' }] }),
    );

    expect(html).toContain('Planche I');
    expect(html).toContain('Planche II');
  });

  it('imprime la cote dans l’encadré de chaque planche', () => {
    const html = renderTechnicalReportHtml(model({ annexA: [PLATE] }));

    expect(html).toContain('<span class="planche-cote">A</span>');
  });

  it('légende la planche avec sa cote et l’endroit du relevé', () => {
    const html = renderTechnicalReportHtml(model({ annexA: [PLATE] }));

    expect(html).toContain(
      'Trace papillaire cotée « A », révélée sur la face extérieure de la porte-fenêtre du séjour.',
    );
  });

  it('ne mentionne pas la localisation quand elle manque', () => {
    const html = renderTechnicalReportHtml(
      model({ annexA: [{ ...PLATE, location: null }] }),
    );

    expect(html).toContain('Trace papillaire cotée « A ».');
    expect(html).not.toContain('localisation non renseignée');
  });

  it('écrit le repli quand la photographie de localisation est illisible, sans perdre la trace', () => {
    const html = renderTechnicalReportHtml(
      model({ annexA: [{ ...PLATE, locationPhoto: null }] }),
    );

    expect(html).toContain(
      "L'image n'a pas pu être relue à l'édition du présent rapport.",
    );
    expect(html).toContain('data:image/png;base64,BBB');
  });

  it('n’imprime aucune annexe A, ni son renvoi au sommaire, sans trace exploitable', () => {
    const html = renderTechnicalReportHtml(model({ annexA: [] }));

    expect(html).not.toContain(
      'Annexe A — Localisation des traces papillaires',
    );
    expect(html).not.toContain('class="planche"');
    expect(html).toContain('Annexe C — Journal des actes');
  });
});

const MARKED = [
  { number: 1, x: 120, y: 340, radius: 6, label: 'bifurcation' },
  { number: 2, x: 220, y: 440, radius: 6, label: 'arrêt de ligne' },
];

function outsideSvg(html: string): string {
  return html.replace(/<svg[\s\S]*?<\/svg>/g, '');
}

describe('renderTechnicalReportHtml — annexe B', () => {
  it('ouvre l’annexe par sa page de titre', () => {
    const html = renderTechnicalReportHtml(
      model({ annexB: [demonstration()] }),
    );

    expect(html).toContain('Annexe B — Démonstrations d&#39;identité');
    expect(html).toContain('Dossier 3455 — procès-verbal PV-2026-001');
  });

  it('rappelle en sous-titre de quelle trace la démonstration parle', () => {
    const html = renderTechnicalReportHtml(
      model({ annexB: [demonstration()] }),
    );

    expect(html).toContain(
      'Démonstration d&#39;identité — trace papillaire cotée « B »',
    );
  });

  it('tient une démonstration en deux planches, la trace puis l’empreinte', () => {
    const html = renderTechnicalReportHtml(
      model({ annexB: [demonstration()] }),
    );

    expect(html.indexOf('Planche I')).toBeLessThan(html.indexOf('Planche II'));
    expect(html).not.toContain('Planche III');
    expect(html).not.toContain('Planche I — localisation');
  });

  it('numérote les planches en continu d’une démonstration à la suivante', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration(),
          demonstration({ reference: '3455-T5', cote: 'E' }),
        ],
      }),
    );

    expect(html).toContain('Planche III');
    expect(html).toContain('Planche IV');
    expect(html).not.toContain('Planche V<');
  });

  it('poursuit la numérotation romaine d’une démonstration à la suivante', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration(),
          demonstration({ reference: '3455-T5', cote: 'E' }),
        ],
      }),
    );

    expect(html.indexOf('Planche IV')).toBeGreaterThan(
      html.indexOf('Planche III'),
    );
    expect(html).not.toContain('Planche V<');
  });

  it('porte les mêmes numéros et les mêmes noms de points sur les deux planches', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    const names = html.match(/1 — bifurcation, 2 — arrêt de ligne/g) ?? [];
    expect(names).toHaveLength(2);
    expect(html).toContain('DEUX (2) minuties concordantes numérotées');
  });

  it('dit que l’appariement a été établi point par point', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    expect(html).toContain(
      'Index droit de Madame BERGER Hélène. Chaque numéro désigne le même détail que sur la planche précédente : l&#39;appariement a été établi point par point par l&#39;expert.',
    );
  });

  it('ne promet aucune numérotation quand aucune paire n’est enregistrée', () => {
    const html = renderTechnicalReportHtml(
      model({ annexB: [demonstration()] }),
    );

    expect(html).toContain('Trace papillaire cotée « B ».');
    expect(html).not.toContain('minuties concordantes numérotées');
    expect(html).not.toContain('point par point');
  });

  it('n’imprime aucune coordonnée hors du dessin', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    const printed = outsideSvg(html);
    expect(printed).not.toContain('120');
    expect(printed).not.toContain('340');
    expect(printed).not.toContain('<pre');
  });

  it('donne au dessin une taille imprimable', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    expect(html).toContain(
      '<svg width="800" height="1200" viewBox="0 0 800 1200"',
    );
  });

  it('ajuste le dessin à la planche comme une image simple', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    expect(html).toContain(
      '.planche-image img, .planche-image svg { max-height: 150mm; max-width: 100%; width: auto; height: auto; }',
    );
  });

  it('écrit le repli quand les dimensions natives de l’image sont illisibles', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: {
              image: {
                dataUrl: 'data:image/tiff;base64,AAA',
                width: null,
                height: null,
                observedSha256: null,
                lifeSizeMm: null,
              },
              marks: MARKED,
            },
          }),
        ],
      }),
    );

    expect(html).toContain(
      "Les dimensions natives de cette image n'ont pas pu être lues",
    );
    expect(html).toContain('<img src="data:image/tiff;base64,AAA"');
  });

  it('écrit le repli quand l’image n’a pas pu être relue', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [demonstration({ trace: { image: null, marks: MARKED } })],
      }),
    );

    expect(html).toContain(
      "L'image n'a pas pu être relue à l'édition du présent rapport.",
    );
  });

  it('ouvre la démonstration par la trace scellée quand l’atelier l’a retravaillée', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            rawTrace: IMAGE,
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    expect(html).toContain('Planche I');
    expect(html).toContain('Planche II');
    expect(html).toContain('Planche III');
    expect(html).toContain(
      'Trace papillaire cotée « B », telle qu’elle a été scellée au dossier.',
    );
    expect(html).toContain(
      'Trace papillaire cotée « B », après les traitements enregistrés au dossier. DEUX (2) minuties concordantes numérotées.',
    );
  });

  it('ne numérote la démonstration suivante qu’après les trois planches', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            rawTrace: IMAGE,
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
          demonstration({ reference: '3455-T5', cote: 'E' }),
        ],
      }),
    );

    expect(html).toContain('Planche IV');
    expect(html).toContain('Planche V<');
    expect(html).not.toContain('Planche VI');
  });

  it('n’ouvre par la trace scellée que si elle diffère de celle qu’on démontre', () => {
    const html = renderTechnicalReportHtml(
      model({
        annexB: [
          demonstration({
            trace: { image: IMAGE, marks: MARKED },
            referencePrint: { image: IMAGE, marks: MARKED },
          }),
        ],
      }),
    );

    expect(html).not.toContain('telle qu’elle a été scellée au dossier');
    expect(html).not.toContain('après les traitements enregistrés au dossier');
    expect(html).not.toContain('Planche III');
  });

  it('n’imprime aucune annexe B, ni son renvoi au sommaire, sans identification', () => {
    const html = renderTechnicalReportHtml(model({ annexB: [] }));

    expect(html).not.toContain('Annexe B — Démonstrations d&#39;identité');
    expect(html).not.toContain("Annexe B — Démonstrations d'identité");
    expect(html).not.toContain('class="planche"');
  });
});

const SERMENT =
  'Je soussigné Julien Marchand, brigadier-chef en fonction au SRPTS de Paris, ' +
  'expert désigné, prête serment de bien et fidèlement remplir ma mission en mon ' +
  'honneur et conscience.';

const SAISINE = {
  expert: {
    displayName: 'Julien Marchand',
    grade: 'Brigadier-chef',
    serviceNumber: 'PTS-0042',
    role: 'OPERATOR',
  },
  oathStatement: SERMENT,
  courtReference: 'Tribunal judiciaire de Paris',
  swornAt: new Date('2026-03-06T09:00:00.000Z'),
  magistrateName: 'Claire Rousseau',
  magistrateTitle: "Juge d'instruction",
  ordinanceDate: new Date('2026-03-04T00:00:00.000Z'),
  missionObject: 'exploitation des traces papillaires',
  sealCount: 2,
  prorogationDeadline: new Date('2026-06-30T00:00:00.000Z'),
  prorogationOrdinanceDate: new Date('2026-05-02T00:00:00.000Z'),
  biologicalPrecautions: true,
  assistants: [{ name: 'Paul Ferrand', task: 'ouverture du véhicule' }],
};

describe('renderTechnicalReportHtml — saisine', () => {
  it("imprime la commission complète d'un dossier en expertise", () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html).toContain('<h2>1. Saisine</h2>');
    expect(html).toContain('Claire Rousseau, Juge d&#39;instruction');
    expect(html).toContain('Tribunal judiciaire de Paris');
    expect(html).toContain('par ordonnance du 4 mars 2026');
    expect(html).toContain('portant sur 2 scellés');
  });

  it('imprime le serment tel quel', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html).toContain(
      'prête serment de bien et fidèlement remplir ma mission',
    );
    expect(html).toContain('Serment prêté le 6 mars 2026 par Julien Marchand');
  });

  it('nomme les assistants et la tâche pour laquelle ils ont été sollicités', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html).toContain('Paul Ferrand (ouverture du véhicule)');
  });

  it('imprime la prorogation avec ses deux dates', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html).toContain('prorogé par ordonnance du 2 mai 2026');
    expect(html).toContain('au 30 juin 2026');
  });

  it("imprime les précautions en vue d'analyses biologiques", () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html).toContain('analyses biologiques ultérieures');
  });

  it("n'imprime ni assistant ni prorogation ni précautions quand rien n'est déclaré", () => {
    const html = renderTechnicalReportHtml(
      model({
        saisine: {
          ...SAISINE,
          assistants: [],
          prorogationDeadline: null,
          prorogationOrdinanceDate: null,
          biologicalPrecautions: false,
        },
      }),
    );

    expect(html).toContain('<h2>1. Saisine</h2>');
    expect(html).not.toContain('Ont assisté');
    expect(html).not.toContain('prorogé par ordonnance');
    expect(html).not.toContain('analyses biologiques ultérieures');
  });

  it('renvoie au service requérant sur un dossier ordinaire', () => {
    const html = renderTechnicalReportHtml(model({ saisine: null }));

    expect(html).toContain('<h2>1. Saisine</h2>');
    expect(html).toContain('à la demande du service requérant');
    expect(html).toContain("aucune ordonnance de commission d'expert");
    expect(html).not.toContain('Sur commission de');
    expect(html).not.toContain('prête serment');
  });
});

describe('renderTechnicalReportHtml — numérotation des sections', () => {
  it('ouvre le corps du rapport par la section 1, Saisine', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html.indexOf('<h2>1. Saisine</h2>')).toBeLessThan(
      html.indexOf('<h2>2. Objet et pièces examinées</h2>'),
    );
  });

  it('numérote les sections suivantes de 2 à 8', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    for (const title of [
      '<h2>2. Objet et pièces examinées</h2>',
      '<h2>3. Méthodes et techniques employées</h2>',
      '<h2>4. Traces papillaires examinées</h2>',
      '<h2>5. Exploitabilité et cotation</h2>',
      '<h2>6. Comparaisons et identifications</h2>',
      '<h2>7. Traitements appliqués aux images et intégrité des pièces</h2>',
      '<h2>8. Conclusion</h2>',
    ]) {
      expect(html).toContain(title);
    }
  });

  it('ne laisse plus aucune section numérotée à l’ancienne', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    expect(html).not.toContain('<h2>1. Objet et pièces examinées</h2>');
    expect(html).not.toContain('<h2>7. Conclusion</h2>');
  });

  it('fait dire la même chose au sommaire', () => {
    const html = renderTechnicalReportHtml(model({ saisine: SAISINE }));

    for (const line of [
      '<li>1. Saisine</li>',
      '<li>2. Objet et pièces examinées</li>',
      '<li>3. Méthodes et techniques employées</li>',
      '<li>4. Traces papillaires examinées</li>',
      '<li>5. Exploitabilité et cotation</li>',
      '<li>6. Comparaisons et identifications</li>',
      '<li>7. Traitements appliqués aux images et intégrité des pièces</li>',
      '<li>8. Conclusion</li>',
    ]) {
      expect(html).toContain(line);
    }
  });

  it('numérote la section 1 même sur un dossier ordinaire', () => {
    const html = renderTechnicalReportHtml(model({ saisine: null }));

    expect(html).toContain('<h2>1. Saisine</h2>');
    expect(html).toContain('<li>1. Saisine</li>');
  });
});

describe('renderTechnicalReportHtml — annexe D, la vérification', () => {
  const VERIFICATION = {
    verifier: {
      displayName: 'Lucie Bernard',
      grade: 'Brigadier',
      serviceNumber: 'PTS-0042',
      role: 'OPERATOR',
    },
    requestedAt: new Date('2026-08-10T08:00:00.000Z'),
    completedAt: new Date('2026-08-12T08:00:00.000Z'),
    verdictLabel: 'Vérification discordante',
    traces: [
      {
        traceDesignation: 'la trace 3455-T1 cotée « A »',
        resultLabel: 'Discordance — un troisième examen est nécessaire',
      },
      {
        traceDesignation: 'la trace 3455-T2 cotée « B »',
        resultLabel: 'Conclusions concordantes',
      },
    ],
    actGroups: [
      {
        pieceDesignation: 'la trace 3455-T1 cotée « A »',
        acts: [
          {
            order: 1,
            occurredAt: new Date('2026-08-11T09:00:00.000Z'),
            actorDisplayName: 'Lucie Bernard',
            sentence: 'Minutie relevée sur la trace 3455-T1 cotée « A »',
          },
        ],
      },
    ],
  };

  it("n'imprime aucune annexe D sur un dossier jamais vérifié, ni ne l'annonce", () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).not.toContain('Annexe D');
    expect(html).not.toContain('vérificateur');
  });

  it('annonce l’annexe D au sommaire dès qu’une vérification est close', () => {
    const html = renderTechnicalReportHtml(
      model({ verifications: [VERIFICATION] }),
    );

    expect(html).toContain('Annexe D — Vérification par un second regard');
  });

  it('imprime le vérificateur, sa qualité et les deux dates de sa mission', () => {
    const html = renderTechnicalReportHtml(
      model({ verifications: [VERIFICATION] }),
    );

    expect(html).toContain('Lucie Bernard');
    expect(html).toContain('matricule PTS-0042');
    expect(html).toContain('Vérification discordante');
    expect(html).toContain('12/08/2026');
  });

  it('imprime le résultat de chaque trace et les actes regroupés par pièce', () => {
    const html = renderTechnicalReportHtml(
      model({ verifications: [VERIFICATION] }),
    );

    expect(html).toContain('Discordance — un troisième examen est nécessaire');
    expect(html).toContain('Conclusions concordantes');
    expect(html).toContain('Actes sur la trace 3455-T1');
    expect(html).toContain('Minutie relevée sur la trace 3455-T1');
  });

  it('imprime les vérifications successives dans leur ordre', () => {
    const html = renderTechnicalReportHtml(
      model({
        verifications: [
          VERIFICATION,
          { ...VERIFICATION, verdictLabel: 'Vérification concordante' },
        ],
      }),
    );

    expect(html.indexOf('Vérification 1')).toBeLessThan(
      html.indexOf('Vérification 2'),
    );
  });

  it('dit le compte supprimé plutôt qu’un vérificateur vide', () => {
    const html = renderTechnicalReportHtml(
      model({
        verifications: [{ ...VERIFICATION, verifier: null, actGroups: [] }],
      }),
    );

    expect(html).toContain('Compte supprimé du service');
    expect(html).toContain('Aucun acte du vérificateur sur les images.');
  });

  it('imprime l’annexe D après le journal des actes', () => {
    const html = renderTechnicalReportHtml(
      model({ verifications: [VERIFICATION] }),
    );

    expect(html.indexOf('Annexe C — Journal des actes')).toBeLessThan(
      html.indexOf('Annexe D — Vérification par un second regard'),
    );
  });
});

describe('renderTechnicalReportHtml — la garde et les champs renseignés', () => {
  it('porte la date d’intervention sous les références', () => {
    const html = renderTechnicalReportHtml(model());
    const garde = html.slice(0, html.indexOf('<div class="sommaire">'));

    expect(garde).toContain('Date d’intervention');
    expect(garde).toContain('14 mars 2026');
  });

  it('omet la rubrique du destinataire quand elle n’est pas renseignée', () => {
    const html = renderTechnicalReportHtml(
      model({ caseHeader: { ...model().caseHeader, recipient: null } }),
    );

    expect(html).not.toContain('Destinataire');
    expect(html).not.toContain('Non renseigné');
  });

  it('omet « Affaire contre » quand il n’est pas renseigné', () => {
    const html = renderTechnicalReportHtml(
      model({ caseHeader: { ...model().caseHeader, caseAgainst: null } }),
    );

    expect(html).not.toContain('Affaire contre');
  });

  it('imprime le résumé des faits en sous-section de la saisine', () => {
    const html = renderTechnicalReportHtml(
      model({
        caseHeader: {
          ...model().caseHeader,
          description: 'Effraction de la porte-fenêtre du séjour.',
        },
      }),
    );

    expect(html).toContain('<h3>Résumé des faits</h3>');
    expect(html).toContain('Effraction de la porte-fenêtre du séjour.');
    expect(html.indexOf('<h3>Résumé des faits</h3>')).toBeGreaterThan(
      html.indexOf('<h2>1. Saisine</h2>'),
    );
    expect(html.indexOf('<h3>Résumé des faits</h3>')).toBeLessThan(
      html.indexOf('<h2>2.'),
    );
  });

  it('n’ouvre pas de sous-section quand le résumé des faits est absent', () => {
    expect(renderTechnicalReportHtml(model())).not.toContain(
      'Résumé des faits',
    );
  });

  it('complète l’état civil de la personne identifiée quand la fiche le porte', () => {
    const html = renderTechnicalReportHtml(
      model({
        identifications: [
          {
            cote: 'A',
            position: "à l'index droit",
            subject: {
              civility: 'Monsieur',
              firstName: 'Samir',
              lastName: 'Sadik',
              sex: 'MALE',
              birthDate: new Date('1979-04-02T00:00:00.000Z'),
              birthPlace: 'Paris',
            },
          },
        ],
      }),
    );

    expect(html).toContain('Monsieur SADIK Samir, né le 02/04/1979 à Paris');
  });

  it('n’écrit rien sur l’état civil que la fiche ne porte pas', () => {
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain('Monsieur SADIK Samir,');
    expect(html).not.toContain('né le');
    expect(html).not.toContain('non renseigné');
  });
});
