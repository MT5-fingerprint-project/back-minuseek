import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import type { PieceData } from '../../ports/case-report-data.reader';
import type { ChainAttestation } from '../../ports/chain-attestation.port';
import type {
  AnchorData,
  AuditEventData,
} from '../../ports/traceability-data.reader';
import {
  buildIntegritySection,
  IntegritySectionInput,
} from './integrity-section.builder';
import { PieceDesignation } from './piece-designations';

const AT = new Date('2026-03-16T17:03:00.000Z');
const SEAL = 'a'.repeat(64);
const OTHER_SEAL = 'b'.repeat(64);
const TRACE_PATH = 'media/case-1/traces/trace-2.png';

const NAMED: Map<string, PieceDesignation> = new Map([
  [
    'trace-2',
    { full: 'la trace 3455-T2 cotée « B »', bare: 'la trace 3455-T2' },
  ],
]);

const VERIFIED: ChainAttestation = {
  ok: true,
  eventsChecked: 12,
  firstBrokenSeq: null,
  anchorsVerified: 1,
  anchorsFailed: 0,
};

function trace(overrides: Partial<PieceData> = {}): PieceData {
  return {
    id: 'trace-2',
    path: TRACE_PATH,
    sha256: SEAL,
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
    number: 2,
    origin: null,
    location: null,
    revelationTechnique: null,
    cote: 'B',
    notIdentifiedAt: null,
    ...overrides,
  };
}

function event(
  seq: number,
  eventType: AuditEventTypeEnum,
  payload: Record<string, unknown>,
  occurredAt: Date = AT,
): AuditEventData {
  return {
    seq,
    eventType,
    traceId: null,
    evidenceClass: 'OBSERVED',
    actorDisplayName: 'Sébastien Aguilar',
    occurredAt,
    payload,
    hash: 'c'.repeat(64),
    prevHash: 'd'.repeat(64),
  };
}

function deposit(
  seq = 5,
  overrides: Record<string, unknown> = {},
): AuditEventData {
  return event(seq, AuditEventTypeEnum.TRACE_UPLOADED, {
    fileSha256: SEAL,
    storagePath: TRACE_PATH,
    sizeBytes: 1024,
    mimeType: 'image/png',
    ...overrides,
  });
}

function filterLayer(
  seq: number,
  eventType: AuditEventTypeEnum,
  settings: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  occurredAt: Date = AT,
): AuditEventData {
  return event(
    seq,
    eventType,
    {
      layerId: 'layer-1',
      fingerprintId: 'trace-2',
      name: 'Luminosité',
      type: 'FILTER',
      zIndex: 1,
      isVisible: true,
      settings,
      ...extra,
    },
    occurredAt,
  );
}

function anchor(headSeq: number, anchoredAt: Date): AnchorData {
  return {
    headSeq,
    headHash: 'e'.repeat(64),
    tsaUrl: 'https://freetsa.org/tsr',
    anchoredAt,
    tsrSha256: 'f'.repeat(64),
  };
}

function build(overrides: Partial<IntegritySectionInput> = {}) {
  return buildIntegritySection({
    traces: [trace()],
    referencePrints: [],
    designations: NAMED,
    events: [],
    anchors: [],
    attestation: VERIFIED,
    verificationUrl: 'https://minuseek.fr/srpts-paris/verifier',
    ...overrides,
  });
}

describe('buildIntegritySection — le scellé', () => {
  it('rattache l’inscription de dépôt par le chemin de stockage', () => {
    const [piece] = build({ events: [deposit(5)] }).traces;

    expect(piece).toMatchObject({
      designation: 'la trace 3455-T2 cotée « B »',
      cote: 'B',
      recordedSha256: SEAL,
      sealedAt: AT,
      recordEntryNumber: 5,
    });
  });

  it('ne rattache pas une inscription qui désigne un autre fichier', () => {
    const [piece] = build({
      events: [deposit(5, { storagePath: 'media/case-1/traces/trace-9.png' })],
    }).traces;

    expect(piece.recordedSha256).toBeNull();
    expect(piece.sealedAt).toBeNull();
    expect(piece.recordEntryNumber).toBeNull();
  });

  it('retient la valeur du registre et signale la divergence de la fiche', () => {
    const [piece] = build({
      traces: [trace({ sha256: OTHER_SEAL })],
      events: [deposit(5)],
    }).traces;

    expect(piece.recordedSha256).toBe(SEAL);
    expect(piece.currentRowSha256).toBe(OTHER_SEAL);
    expect(piece.divergesFromRecord).toBe(true);
  });

  it('ne crie pas à la divergence quand la fiche et le registre s’accordent', () => {
    expect(build({ events: [deposit(5)] }).traces[0].divergesFromRecord).toBe(
      false,
    );
  });

  it('ne crie pas à la divergence quand la fiche ne porte aucune empreinte', () => {
    const [piece] = build({
      traces: [trace({ sha256: null })],
      events: [deposit(5)],
    }).traces;

    expect(piece.divergesFromRecord).toBe(false);
  });

  it('marque le fichier comme dérivé quand un TIFF reçu est servi en PNG', () => {
    const [piece] = build({
      events: [deposit(5, { mimeType: 'image/tiff' })],
    }).traces;

    expect(piece.servedFileIsDerived).toBe(true);
    expect(piece.observedMatchesRecord).toBeNull();
  });

  it('ne marque rien comme dérivé quand le fichier reçu est celui qu’on sert', () => {
    expect(build({ events: [deposit(5)] }).traces[0].servedFileIsDerived).toBe(
      false,
    );
  });
});

describe('buildIntegritySection — les traitements', () => {
  it('n’inscrit que les réglages d’image, jamais les relevés de minuties', () => {
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(6, AuditEventTypeEnum.LAYER_CREATED, {
          filterKey: 'brightness',
          value: 20,
        }),
        event(7, AuditEventTypeEnum.LAYER_CREATED, {
          layerId: 'layer-2',
          fingerprintId: 'trace-2',
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 2,
          isVisible: true,
          settings: { type: 'minutiae', x: 10, y: 20 },
        }),
      ],
    }).traces;

    expect(piece.treatments).toHaveLength(1);
    expect(piece.treatments[0].sentence).toBe('Luminosité portée à +20 %');
  });

  it('ne retient qu’un traitement par calque, avec son dernier réglage', () => {
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(6, AuditEventTypeEnum.LAYER_CREATED, {
          filterKey: 'brightness',
          value: 10,
        }),
        filterLayer(7, AuditEventTypeEnum.LAYER_UPDATED, {
          filterKey: 'brightness',
          value: 20,
        }),
      ],
    }).traces;

    expect(piece.treatments).toHaveLength(1);
    expect(piece.treatments[0].sentence).toBe('Luminosité portée à +20 %');
  });

  it('date la pose et nomme celui qui l’a posée', () => {
    const posedAt = new Date('2026-03-16T17:10:00.000Z');
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(
          6,
          AuditEventTypeEnum.LAYER_CREATED,
          { filterKey: 'brightness', value: 20 },
          {},
          posedAt,
        ),
      ],
    }).traces;

    expect(piece.treatments[0]).toMatchObject({
      appliedAt: posedAt,
      actorDisplayName: 'Sébastien Aguilar',
      removedAt: null,
      hiddenAtEdition: false,
    });
  });

  it('date le retrait d’un réglage', () => {
    const removedAt = new Date('2026-03-16T17:20:00.000Z');
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(6, AuditEventTypeEnum.LAYER_CREATED, {
          filterKey: 'brightness',
          value: 20,
        }),
        filterLayer(
          7,
          AuditEventTypeEnum.LAYER_DELETED,
          { filterKey: 'brightness', value: 20 },
          {},
          removedAt,
        ),
      ],
    }).traces;

    expect(piece.treatments[0].removedAt).toEqual(removedAt);
  });

  it('signale un réglage masqué à la date d’édition', () => {
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(6, AuditEventTypeEnum.LAYER_CREATED, {
          filterKey: 'brightness',
          value: 20,
        }),
        filterLayer(
          7,
          AuditEventTypeEnum.LAYER_UPDATED,
          { filterKey: 'brightness', value: 20 },
          { isVisible: false },
        ),
      ],
    }).traces;

    expect(piece.treatments[0].hiddenAtEdition).toBe(true);
  });

  it('ignore les réglages posés sur une autre pièce', () => {
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(
          6,
          AuditEventTypeEnum.LAYER_CREATED,
          { filterKey: 'brightness', value: 20 },
          { fingerprintId: 'trace-9' },
        ),
      ],
    }).traces;

    expect(piece.treatments).toEqual([]);
  });
});

describe('buildIntegritySection — les horodatages extérieurs', () => {
  it('retient la première ancre couvrante, pas la dernière', () => {
    const [piece] = build({
      events: [
        deposit(5),
        filterLayer(30, AuditEventTypeEnum.LAYER_CREATED, {
          filterKey: 'brightness',
          value: 20,
        }),
      ],
      anchors: [
        anchor(10, new Date('2026-03-16T10:00:00.000Z')),
        anchor(40, new Date('2026-03-17T02:00:00.000Z')),
        anchor(90, new Date('2026-03-18T02:00:00.000Z')),
      ],
    }).traces;

    expect(piece.lastActEntryNumber).toBe(30);
    expect(piece.coveringAnchor).toEqual({
      anchoredAt: new Date('2026-03-17T02:00:00.000Z'),
      authority: 'https://freetsa.org/tsr',
      entryNumber: 40,
    });
  });

  it('dit qu’aucun horodatage ne couvre les actes quand la dernière ancre est antérieure', () => {
    const section = build({
      events: [
        deposit(5),
        filterLayer(30, AuditEventTypeEnum.LAYER_CREATED, {
          filterKey: 'brightness',
          value: 20,
        }),
      ],
      anchors: [anchor(10, new Date('2026-03-16T10:00:00.000Z'))],
    });

    expect(section.traces[0].coveringAnchor).toBeNull();
    expect(section.lastAnchor).toEqual({
      anchoredAt: new Date('2026-03-16T10:00:00.000Z'),
      entryNumber: 10,
    });
  });

  it('ne connaît aucune ancre sur un laboratoire jamais horodaté', () => {
    const section = build({ events: [deposit(5)] });

    expect(section.lastAnchor).toBeNull();
    expect(section.traces[0].coveringAnchor).toBeNull();
  });

  it('ne date aucun acte pour une pièce dont rien n’est inscrit', () => {
    const [piece] = build({ anchors: [anchor(10, AT)] }).traces;

    expect(piece.lastActEntryNumber).toBeNull();
    expect(piece.coveringAnchor).toBeNull();
  });
});

describe('buildIntegritySection — l’attestation', () => {
  it('reprend le verdict du vérificateur de chaîne', () => {
    const section = build({
      attestation: {
        ok: false,
        eventsChecked: 40,
        firstBrokenSeq: 17,
        anchorsVerified: 0,
        anchorsFailed: 2,
      },
    });

    expect(section.recordVerifiedAtEdition).toBe(false);
    expect(section.firstBrokenEntryNumber).toBe(17);
    expect(section.anchorsFailed).toBe(2);
  });

  it('porte l’adresse de vérification telle qu’on la lui donne', () => {
    expect(build().verificationUrl).toBe(
      'https://minuseek.fr/srpts-paris/verifier',
    );
  });
});
