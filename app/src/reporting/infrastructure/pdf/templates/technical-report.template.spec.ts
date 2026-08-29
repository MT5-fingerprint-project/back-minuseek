import { TechnicalReportViewModel } from '../../../application/report-view-model';
import { renderTechnicalReportHtml } from './technical-report.template';

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
    },
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
        withdrawal: null,
      },
      {
        reference: '3455-T2',
        exploitability: 'EXPLOITABLE',
        cote: 'B',
        discrimination: 'Non examinée',
        withdrawal: null,
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
    identifications: [
      {
        cote: 'A',
        position: "à l'index droit",
        civility: 'Monsieur',
        firstName: 'Samir',
        lastName: 'Sadik',
      },
    ],
    negativeCotes: [],
    notExaminedCotes: ['B'],
    imageTreatments: [
      {
        reference: '3455-T1',
        cote: 'A',
        sealedAt: new Date('2026-03-14T16:42:00.000Z'),
        treatments: 'Luminosité +20 %, contraste +15 %',
      },
    ],
    independentTimestampAt: new Date('2026-03-15T03:00:00.000Z'),
    counts: {
      total: 2,
      exploitable: 2,
      notExploitable: 0,
      identified: 1,
      negative: 0,
      notExamined: 1,
    },
    traces: [],
    referencePrints: [],
    identityDemonstrations: [],
    journal: { chained: [] },
    ...overrides,
  };
}

const SECTION_TITLES = [
  '1. Objet et pièces examinées',
  '2. Méthodes et techniques employées',
  '3. Traces papillaires examinées',
  '4. Exploitabilité et cotation',
  '5. Comparaisons et identifications',
  '6. Traitements appliqués aux images et intégrité des pièces',
  '7. Conclusion',
];

describe('renderTechnicalReportHtml — structure', () => {
  it('sort les sept sections dans l’ordre', () => {
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
    const html = renderTechnicalReportHtml(model());

    expect(html).toContain(
      'Annexe A — Planches des traces papillaires exploitables',
    );
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
      model({ negativeCotes: ['C'], notExaminedCotes: ['F'] }),
    );

    const flat = html.replace(/\s+/g, ' ');

    expect(flat).toContain(
      "La trace papillaire cotée <b>« C »</b> n'a pas été identifiée au terme des comparaisons effectuées.",
    );
    expect(flat).toContain(
      "La trace papillaire cotée <b>« F »</b> n'a pas encore été examinée.",
    );
  });

  it('remplace la cote et la discrimination d’une trace retirée par la phrase de retrait', () => {
    const html = renderTechnicalReportHtml(
      model({
        exploitability: [
          {
            reference: '3455-T1',
            exploitability: 'EXPLOITABLE',
            cote: '/',
            discrimination: '/',
            withdrawal:
              "Retirée du dossier le 12 août 2026 — doublon d'une pièce déjà versée",
          },
        ],
      }),
    );

    expect(html).toContain(
      '<td colspan="2">Retirée du dossier le 12 août 2026 — doublon d&#39;une pièce déjà versée</td>',
    );
  });

  it('n’affirme pas d’horodatage indépendant quand il n’y en a pas', () => {
    const html = renderTechnicalReportHtml(
      model({ independentTimestampAt: null }),
    );

    expect(html).not.toContain('horodaté par un tiers');
    expect(html).toContain('Le détail acte par acte figure en Annexe C.');
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
    expect(html).toContain('Fait le 19/08/2026');
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
