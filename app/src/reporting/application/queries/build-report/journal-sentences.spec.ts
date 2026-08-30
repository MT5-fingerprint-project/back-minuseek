import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { AuditEventData } from '../../ports/traceability-data.reader';
import { journalSentence } from './journal-sentences';
import { PieceDesignation } from './piece-designations';

const AT = new Date('2026-03-16T17:03:00.000Z');

const NAMED: Map<string, PieceDesignation> = new Map([
  [
    'trace-7',
    { full: 'la trace 3455-T7 cotée « B »', bare: 'la trace 3455-T7' },
  ],
  [
    'ref-1',
    {
      full: "l'empreinte de l'index droit de Madame BERGER Hélène",
      bare: "l'empreinte de l'index droit de Madame BERGER Hélène",
    },
  ],
]);

function event(
  eventType: AuditEventTypeEnum,
  payload: Record<string, unknown> = {},
  traceId: string | null = null,
): AuditEventData {
  return {
    seq: 1,
    eventType,
    traceId,
    evidenceClass: 'OBSERVED',
    actorDisplayName: 'Sébastien Aguilar',
    actorSub: 'sub-aguilar',
    occurredAt: AT,
    payload,
    hash: 'a'.repeat(64),
    prevHash: 'b'.repeat(64),
  };
}

function say(
  eventType: AuditEventTypeEnum,
  payload: Record<string, unknown> = {},
  traceId: string | null = null,
): string {
  return journalSentence(event(eventType, payload, traceId), NAMED);
}

describe('journalSentence — le catalogue', () => {
  it('donne une phrase à chaque type du catalogue, sans jamais tomber sur le repli', () => {
    for (const eventType of Object.values(AuditEventTypeEnum)) {
      const sentence = say(eventType);

      expect(sentence).not.toContain('Acte enregistré :');
      expect(sentence.length).toBeGreaterThan(0);
    }
  });

  it('nomme un type inconnu plutôt que d’échouer', () => {
    expect(say('DOSSIER_ENVOYE_PAR_PIGEON' as AuditEventTypeEnum)).toBe(
      'Acte enregistré : DOSSIER_ENVOYE_PAR_PIGEON',
    );
  });
});

describe('journalSentence — le dossier', () => {
  it('dit l’ouverture avec son numéro et son procès-verbal', () => {
    expect(
      say(AuditEventTypeEnum.CASE_OPENED, {
        caseNumber: '3455',
        pvNumber: '2026-00318',
        operatorUserId: 'user-1',
      }),
    ).toBe('Ouverture du dossier 3455, procès-verbal 2026-00318');
  });

  it('dit le nouveau statut en français', () => {
    expect(
      say(AuditEventTypeEnum.CASE_STATUS_CHANGED, {
        previousStatus: 'OPEN',
        newStatus: 'CLOSED',
        reason: null,
        destroyedPrintCount: 0,
      }),
    ).toBe('Statut du dossier porté à clos');
  });

  it('lit le nom de l’opérateur dans le maillon', () => {
    expect(
      say(AuditEventTypeEnum.CASE_OPERATOR_CHANGED, {
        previousOperatorUserId: 'user-1',
        previousOperatorName: 'Aude Bordier',
        newOperatorUserId: 'user-2',
        newOperatorName: 'Lucile Guichard',
      }),
    ).toBe('Dossier confié à Lucile Guichard');
  });

  it('retombe sur l’identifiant quand le maillon ne porte pas le nom', () => {
    expect(
      say(AuditEventTypeEnum.CASE_OPERATOR_CHANGED, {
        newOperatorUserId: 'user-2',
        newOperatorName: null,
      }),
    ).toBe('Dossier confié à user-2');
  });
});

describe('journalSentence — les pièces', () => {
  it('désigne la trace déposée par son numéro et sa cote', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_UPLOADED,
        {
          fileSha256: 'a'.repeat(64),
          storagePath: 'media/case-1/traces/trace-7.png',
          sizeBytes: 1024,
          mimeType: 'image/png',
        },
        'trace-7',
      ),
    ).toBe('Dépôt de la trace 3455-T7 cotée « B » et mise sous scellé');
  });

  it('désigne l’empreinte de référence par son doigt et sa personne', () => {
    expect(
      say(AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED, {
        referencePrintId: 'ref-1',
        fileSha256: 'a'.repeat(64),
        storagePath: 'media/case-1/reference-prints/ref-1.png',
        sizeBytes: 1024,
        mimeType: 'image/png',
      }),
    ).toBe(
      "Dépôt de l'empreinte de l'index droit de Madame BERGER Hélène et mise sous scellé",
    );
  });

  it('dit le retrait et son motif', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_DELETED,
        {
          traceId: 'trace-7',
          storagePath: 'media/case-1/traces/trace-7.png',
          fileSha256: 'a'.repeat(64),
          motive: 'MISFILED',
        },
        'trace-7',
      ),
    ).toBe(
      'Retrait de la trace 3455-T7 cotée « B » du dossier — pièce versée par erreur dans ce dossier',
    );
  });

  it('dit la fiche de la trace et les trois valeurs qu’elle porte', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_DESCRIBED,
        {
          origin: 'DIGITAL',
          location: "Sur l'extérieur de la porte d'entrée de l'appartement",
          revelationTechnique: 'FINGERPRINT_POWDER',
        },
        'trace-7',
      ),
    ).toBe(
      'Fiche renseignée sur la trace 3455-T7 — origine : Digitale, ' +
        "localisation : « Sur l'extérieur de la porte d'entrée de l'appartement », " +
        'révélation : Poudre dactyloscopique',
    );
  });

  it('n’invente aucune valeur quand le maillon ne porte pas la fiche', () => {
    expect(say(AuditEventTypeEnum.TRACE_DESCRIBED)).toBe(
      'Fiche renseignée sur une trace papillaire',
    );
  });

  it('dit la localisation consignée sur les lieux, avec la phrase du terrain', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_LOCATION_STATED,
        { location: 'Poignée intérieure de la portière conducteur' },
        'trace-7',
      ),
    ).toBe(
      'Localisation de la trace 3455-T7 consignée sur les lieux, au moment de ' +
        'la capture — « Poignée intérieure de la portière conducteur »',
    );
  });

  it('n’invente aucune phrase quand le maillon ne porte pas la localisation', () => {
    expect(say(AuditEventTypeEnum.TRACE_LOCATION_STATED, {}, 'trace-7')).toBe(
      'Localisation de la trace 3455-T7 consignée sur les lieux, au moment de la capture',
    );
  });

  it('dit le versement d’une photographie de localisation', () => {
    expect(
      say(
        AuditEventTypeEnum.LOCATION_PHOTO_UPLOADED,
        {
          locationPhotoId: 'photo-1',
          fileSha256: 'a'.repeat(64),
          storagePath: 'media/case-1/location-photos/photo-1.png',
        },
        'trace-7',
      ),
    ).toBe(
      'Photographie de localisation de la trace 3455-T7 versée au dossier et ' +
        'mise sous scellé',
    );
  });

  it('dit le retrait d’une photographie de localisation et son motif', () => {
    expect(
      say(
        AuditEventTypeEnum.LOCATION_PHOTO_DELETED,
        {
          locationPhotoId: 'photo-1',
          storagePath: 'media/case-1/location-photos/photo-1.png',
          fileSha256: 'a'.repeat(64),
          motive: 'MISFILED',
        },
        'trace-7',
      ),
    ).toBe(
      'Retrait de la photographie de localisation de la trace 3455-T7 — ' +
        'pièce versée par erreur dans ce dossier',
    );
  });

  it('dit le rétablissement d’une trace', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_RESTORED,
        { withdrawnAt: AT.toISOString() },
        'trace-7',
      ),
    ).toBe('la trace 3455-T7 cotée « B » rétablie au dossier');
  });

  it('nomme génériquement une empreinte que le maillon ne désigne pas', () => {
    expect(
      say(AuditEventTypeEnum.REFERENCE_PRINT_RESTORED, {
        withdrawnAt: AT.toISOString(),
      }),
    ).toBe('une empreinte de référence rétablie au dossier');
  });

  it('dit la destruction de l’image d’un familier', () => {
    expect(
      say(AuditEventTypeEnum.REFERENCE_PRINT_IMAGE_DESTROYED, {
        referencePrintId: 'ref-1',
        subjectId: 'subject-1',
        position: 'RIGHT_INDEX',
        storagePath: 'media/case-1/reference-prints/ref-1.png',
        fileSha256: 'a'.repeat(64),
      }),
    ).toBe(
      "Image de l'empreinte de l'index droit de Madame BERGER Hélène détruite à la clôture du dossier",
    );
  });
});

describe('journalSentence — les réglages et les repères', () => {
  function layer(
    eventType: AuditEventTypeEnum,
    settings: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ): string {
    return say(eventType, {
      layerId: 'layer-1',
      fingerprintId: 'trace-7',
      name: 'Luminosité',
      type: 'FILTER',
      zIndex: 1,
      isVisible: true,
      settings,
      ...extra,
    });
  }

  it('dit la pose d’un réglage sur la pièce concernée', () => {
    expect(
      layer(AuditEventTypeEnum.LAYER_CREATED, {
        filterKey: 'brightness',
        value: 20,
      }),
    ).toBe('Luminosité portée à +20 % sur la trace 3455-T7 cotée « B »');
  });

  it('dit le masquage quand le calque est rendu invisible', () => {
    expect(
      layer(
        AuditEventTypeEnum.LAYER_UPDATED,
        { filterKey: 'contrast', value: 15 },
        { isVisible: false },
      ),
    ).toBe('Réglage de contraste masqué sur la trace 3455-T7 cotée « B »');
  });

  it('dit le retrait d’un réglage', () => {
    expect(
      layer(AuditEventTypeEnum.LAYER_DELETED, {
        filterKey: 'saturation',
        value: -40,
      }),
    ).toBe('Réglage de saturation retiré sur la trace 3455-T7 cotée « B »');
  });

  it.each([
    [AuditEventTypeEnum.LAYER_CREATED, 'Minutie relevée sur'],
    [AuditEventTypeEnum.LAYER_UPDATED, 'Minutie déplacée sur'],
  ])('dit le relevé d’une minutie (%s)', (eventType, expected) => {
    expect(
      say(eventType, {
        layerId: 'layer-1',
        fingerprintId: 'trace-7',
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 1,
        isVisible: true,
        settings: { type: 'minutia', x: 10, y: 20 },
      }),
    ).toBe(`${expected} la trace 3455-T7 cotée « B »`);
  });

  it('dit le retrait d’une minutie', () => {
    expect(
      say(AuditEventTypeEnum.LAYER_DELETED, {
        layerId: 'layer-1',
        fingerprintId: 'trace-7',
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 1,
        isVisible: true,
        settings: { type: 'minutia', x: 10, y: 20 },
      }),
    ).toBe('Minutie retirée de la trace 3455-T7 cotée « B »');
  });

  it('distingue un tracé libre d’une minutie', () => {
    expect(
      say(AuditEventTypeEnum.LAYER_CREATED, {
        layerId: 'layer-1',
        fingerprintId: 'trace-7',
        name: 'Tracé',
        type: 'ANNOTATION',
        zIndex: 1,
        isVisible: true,
        settings: { type: 'freehand', points: [] },
      }),
    ).toBe('Repère tracé sur la trace 3455-T7 cotée « B »');
  });
});

describe('journalSentence — la comparaison', () => {
  it('dit le classement sans jamais imprimer le score', () => {
    const sentence = say(
      AuditEventTypeEnum.COMPARISON_EXECUTED,
      {
        traceId: 'trace-7',
        referencePrintId: 'ref-1',
        score: 812,
        hit: true,
        matchThreshold: 40,
        engineVersion: 'sourceafis-3.18',
      },
      'trace-7',
    );

    expect(sentence).toBe(
      'Classement des empreintes de référence par ressemblance apparente pour la trace 3455-T7 cotée « B »',
    );
    expect(sentence).not.toContain('812');
    expect(sentence).not.toContain('40');
    expect(sentence).not.toContain('sourceafis');
  });

  it('dit l’identification et le nombre de minuties concordantes', () => {
    expect(
      say(
        AuditEventTypeEnum.HIT_RECORDED,
        {
          traceId: 'trace-7',
          referencePrintId: 'ref-1',
          score: 812,
          traceMinutiae: 14,
          referenceMinutiae: 15,
          requiredMinutiae: 12,
        },
        'trace-7',
      ),
    ).toBe(
      "Identification déclarée : la trace 3455-T7 cotée « B » identifiée à l'empreinte de l'index droit de Madame BERGER Hélène, sur la base de 14 minuties concordantes",
    );
  });

  it('n’imprime pas le score dans le retrait d’une identification', () => {
    expect(
      say(
        AuditEventTypeEnum.HIT_REMOVED,
        { traceId: 'trace-7', referencePrintId: 'ref-1' },
        'trace-7',
      ),
    ).toBe(
      "Identification retirée : la trace 3455-T7 cotée « B » / l'empreinte de l'index droit de Madame BERGER Hélène",
    );
  });
});

describe('journalSentence — le registre', () => {
  it('dit l’édition d’un rapport sans son empreinte ni son chemin', () => {
    const sentence = say(AuditEventTypeEnum.REPORT_GENERATED, {
      reportId: 'report-1',
      type: 'TECHNICAL',
      sha256: 'a'.repeat(64),
      storagePath: 'reports/case-1/report-1.pdf',
    });

    expect(sentence).toBe(
      "Édition d'un rapport d'exploitation de traces papillaires",
    );
    expect(sentence).not.toContain('a'.repeat(64));
    expect(sentence).not.toContain('reports/');
  });

  it('dit l’horodatage extérieur sans nommer l’autorité ni le maillon', () => {
    const sentence = say(AuditEventTypeEnum.CHAIN_ANCHORED, {
      headSeq: 42,
      headHash: 'c'.repeat(64),
      tsaUrl: 'https://freetsa.org/tsr',
      tsrSha256: 'd'.repeat(64),
    });

    expect(sentence).toBe(
      'Horodatage du registre du laboratoire par une autorité extérieure',
    );
    expect(sentence).not.toContain('freetsa');
  });

  it('dit sobrement les saisies administratives, sans énumérer leurs valeurs', () => {
    expect(
      say(AuditEventTypeEnum.CASE_UPDATED, {
        changes: { pvNumber: 'PV-2026-118' },
      }),
    ).toBe('Informations du dossier corrigées');
    expect(
      say(AuditEventTypeEnum.SERVICE_HEADER_SAVED, {
        changes: { serviceName: 'S.R.P.T.S.' },
      }),
    ).toBe('En-tête du service enregistré');
  });
});

describe('journalSentence — la qualification', () => {
  it('dit la cote sans la répéter deux fois', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_QUALIFIED,
        { exploitable: true, cote: 'B' },
        'trace-7',
      ),
    ).toBe('la trace 3455-T7 déclarée exploitable, cotée « B »');
  });

  it('dit l’inexploitabilité', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_QUALIFIED,
        { exploitable: false },
        'trace-7',
      ),
    ).toBe('la trace 3455-T7 déclarée inexploitable');
  });

  it('n’invente rien quand le maillon ne porte pas les clés attendues', () => {
    expect(say(AuditEventTypeEnum.TRACE_QUALIFIED, {}, 'trace-7')).toBe(
      'la trace 3455-T7 qualifiée',
    );
  });
});

describe('journalSentence — une calibration', () => {
  it('dit la résolution fixée quand la pièce n’en avait pas', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_CALIBRATED,
        { resolutionDpi: 1207.34, previousResolutionDpi: null },
        'trace-7',
      ),
    ).toBe('Résolution de la trace 3455-T7 fixée à 1207,34 ppp');
  });

  it('dit les deux valeurs quand la résolution est corrigée', () => {
    expect(
      say(
        AuditEventTypeEnum.TRACE_CALIBRATED,
        { resolutionDpi: 600, previousResolutionDpi: 500 },
        'trace-7',
      ),
    ).toBe('Résolution de la trace 3455-T7 corrigée de 500 à 600 ppp');
  });

  it('nomme l’empreinte de référence calibrée', () => {
    expect(
      say(AuditEventTypeEnum.REFERENCE_PRINT_CALIBRATED, {
        referencePrintId: 'ref-1',
        resolutionDpi: 1207.34,
        previousResolutionDpi: null,
      }),
    ).toBe(
      "Résolution de l'empreinte de l'index droit de Madame BERGER Hélène fixée à 1207,34 ppp",
    );
  });

  it('n’invente pas de chiffre quand le maillon n’en porte pas', () => {
    expect(say(AuditEventTypeEnum.TRACE_CALIBRATED, {}, 'trace-7')).toBe(
      'Résolution de la trace 3455-T7 calibrée',
    );
  });
});

describe('journalSentence — la vérification', () => {
  it('nomme le collègue à qui la vérification est confiée', () => {
    expect(
      say(AuditEventTypeEnum.CASE_VERIFICATION_REQUESTED, {
        verifierName: 'Lucie Bernard',
        verifierUserId: 'user-lucie',
      }),
    ).toBe('Vérification du dossier confiée à Lucie Bernard');
  });

  it('retombe sur l’identifiant quand le maillon ne porte pas le nom', () => {
    expect(
      say(AuditEventTypeEnum.CASE_VERIFICATION_REQUESTED, {
        verifierUserId: 'user-lucie',
      }),
    ).toBe('Vérification du dossier confiée à user-lucie');
  });

  it('dit la vérification confiée même sans compte désigné dans le maillon', () => {
    expect(say(AuditEventTypeEnum.CASE_VERIFICATION_REQUESTED)).toBe(
      'Vérification du dossier confiée à un second regard',
    );
  });

  it('dit la conclusion du vérificateur et la pièce qu’il identifie', () => {
    expect(
      say(
        AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
        {
          traceId: 'trace-7',
          exploitability: 'EXPLOITABLE',
          identifiedReferencePrintId: 'ref-1',
        },
        'trace-7',
      ),
    ).toBe(
      'Le vérificateur déclare la trace 3455-T7 exploitable et identifiée à ' +
        "l'empreinte de l'index droit de Madame BERGER Hélène",
    );
  });

  it('dit la conclusion sans identification', () => {
    expect(
      say(
        AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
        { traceId: 'trace-7', exploitability: 'EXPLOITABLE' },
        'trace-7',
      ),
    ).toBe(
      'Le vérificateur déclare la trace 3455-T7 exploitable, sans identification',
    );
  });

  it('dit la trace que le vérificateur juge inexploitable', () => {
    expect(
      say(
        AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
        { traceId: 'trace-7', exploitability: 'NOT_EXPLOITABLE' },
        'trace-7',
      ),
    ).toBe('Le vérificateur déclare la trace 3455-T7 inexploitable');
  });

  it('dit la concordance à la clôture de la mission', () => {
    expect(
      say(AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED, {
        verdict: 'CONCORDANT',
        discordantTraceCount: 0,
      }),
    ).toBe('Vérification close : les conclusions concordent');
  });

  it('compte les traces qui divergent à la clôture de la mission', () => {
    expect(
      say(AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED, {
        verdict: 'DISCORDANT',
        discordantTraceCount: 2,
      }),
    ).toBe('Vérification close : les conclusions divergent sur 2 traces');
  });

  it('accorde le singulier sur une seule trace divergente', () => {
    expect(
      say(AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED, {
        verdict: 'DISCORDANT',
        discordantTraceCount: 1,
      }),
    ).toBe('Vérification close : les conclusions divergent sur 1 trace');
  });

  it("n'affirme rien quand le maillon ne porte pas l'exploitabilité", () => {
    expect(
      say(
        AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
        { traceId: 'trace-7' },
        'trace-7',
      ),
    ).toBe('Conclusion du vérificateur rendue sur la trace 3455-T7');
  });

  it("n'affirme pas la divergence quand le maillon ne porte pas de verdict", () => {
    expect(say(AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED)).toBe(
      'Vérification close',
    );
  });
});
