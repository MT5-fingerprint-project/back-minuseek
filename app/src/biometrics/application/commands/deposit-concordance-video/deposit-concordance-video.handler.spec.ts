import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryConcordanceVideoRepository } from '../../../infrastructure/persistence/in-memory-concordance-video.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemorySealRegistry } from '../../../../audit-trail/infrastructure/persistence/in-memory-seal-registry';
import { ConcordancePairNotFoundError } from '../../../domain/concordance-video/errors/concordance-pair-not-found.error';
import { UnsupportedConcordanceVideoFormatError } from '../../../domain/concordance-video/errors/unsupported-concordance-video-format.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { DepositConcordanceVideoCommand } from './deposit-concordance-video.command';
import { DepositConcordanceVideoHandler } from './deposit-concordance-video.handler';

const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const WEBM_BYTES = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 1, 2, 3]);

const MP4_PATH = 'investigation-case/case-1/concordance-videos/video-1.mp4';

describe('DepositConcordanceVideoHandler', () => {
  let repo: InMemoryConcordanceVideoRepository;
  let storage: InMemoryImageStorageAdapter;
  let locator: InMemoryFingerprintLocatorAdapter;
  let idGenerator: IdGenerator;
  let auditTrail: InMemoryAuditTrailAppender;
  let sealRegistry: InMemorySealRegistry;
  let handler: DepositConcordanceVideoHandler;
  let nextId: string;

  const deposit = (
    traceId = 'trace-1',
    referencePrintId = 'ref-1',
    bytes = MP4_BYTES,
  ) =>
    handler.execute(
      new DepositConcordanceVideoCommand(
        EXPERT_ACTOR,
        'case-1',
        traceId,
        referencePrintId,
        bytes,
      ),
    );

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryConcordanceVideoRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    locator = new InMemoryFingerprintLocatorAdapter();
    sealRegistry = new InMemorySealRegistry();
    nextId = 'video-1';
    idGenerator = { generate: jest.fn(() => nextId) };
    handler = new DepositConcordanceVideoHandler(
      repo,
      storage,
      idGenerator,
      locator,
      sealRegistry,
    );
    locator.setTrace('trace-1', 'case-1');
    locator.setReferencePrint('ref-1', 'case-1');
  });

  it('dépose la vidéo du couple : fichier, acte et retour', async () => {
    const result = await deposit();

    expect(result.id).toBe('video-1');
    expect(result.path).toBe(`media/${MP4_PATH}`);
    expect(result.url).toBe(`/media/${MP4_PATH}`);
    expect(result.sha256).toHaveLength(64);

    const [saved] = await repo.findByPair('trace-1', 'ref-1');
    expect(saved.toPrimitives()).toMatchObject({
      id: 'video-1',
      caseId: 'case-1',
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      sha256: result.sha256,
    });

    const [act] = auditTrail.events;
    expect(act.eventType).toBe(AuditEventTypeEnum.CONCORDANCE_VIDEO_DEPOSITED);
    expect(act.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(act.caseId).toBe('case-1');
    expect(act.traceId).toBe('trace-1');
    expect(act.payload).toMatchObject({
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      fileSha256: result.sha256,
      sizeBytes: MP4_BYTES.length,
      mimeType: 'video/mp4',
    });
  });

  it('accepte le WebM des navigateurs qui ne savent pas produire de MP4', async () => {
    const result = await deposit('trace-1', 'ref-1', WEBM_BYTES);

    expect(result.path).toBe(
      'media/investigation-case/case-1/concordance-videos/video-1.webm',
    );
    expect(auditTrail.events[0].payload.mimeType).toBe('video/webm');
  });

  it('projette le scellé au registre public, avec son maillon', async () => {
    const result = await deposit();

    const link = auditTrail.events.at(-1);
    expect(sealRegistry.seals).toEqual([
      {
        tenantSlug: 'demo',
        sha256: result.sha256,
        kind: 'CONCORDANCE_VIDEO',
        chainSeq: link?.seq,
        sealedAt: link?.occurredAt,
        caseId: 'case-1',
        reportType: null,
        anchoredAt: null,
      },
    ]);
  });

  it('ne perd pas un dépôt réussi quand la projection du scellé échoue', async () => {
    sealRegistry.failWith = new Error("base d'administration injoignable");

    const result = await deposit();

    expect(result.id).toBe('video-1');
    expect(await repo.findByPair('trace-1', 'ref-1')).toHaveLength(1);
  });

  it('refuse une trace inconnue, sans rien écrire', async () => {
    await expect(deposit('unknown', 'ref-1')).rejects.toThrow(
      ConcordancePairNotFoundError,
    );

    expect(auditTrail.events).toHaveLength(0);
    expect(storage.getSaved(MP4_PATH)).toBeUndefined();
  });

  it('refuse une empreinte de référence inconnue, sans rien écrire', async () => {
    await expect(deposit('trace-1', 'unknown')).rejects.toThrow(
      ConcordancePairNotFoundError,
    );

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse un couple dont une pièce vient d’un autre dossier, avec la même erreur (IDOR)', async () => {
    locator.setReferencePrint('ref-ailleurs', 'other-case');

    await expect(deposit('trace-1', 'ref-ailleurs')).rejects.toThrow(
      ConcordancePairNotFoundError,
    );

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse deux traces ou deux empreintes : le couple a un côté et un autre', async () => {
    locator.setTrace('trace-2', 'case-1');

    await expect(deposit('trace-1', 'trace-2')).rejects.toThrow(
      ConcordancePairNotFoundError,
    );
    await expect(deposit('ref-1', 'ref-1')).rejects.toThrow(
      ConcordancePairNotFoundError,
    );

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse un format qui n’est ni MP4 ni WebM, sans rien écrire', async () => {
    await expect(deposit('trace-1', 'ref-1', PNG_BYTES)).rejects.toThrow(
      UnsupportedConcordanceVideoFormatError,
    );

    expect(auditTrail.events).toHaveLength(0);
    expect(storage.getSaved(MP4_PATH)).toBeUndefined();
  });

  it('produit deux pièces distinctes pour deux enregistrements du même couple', async () => {
    nextId = 'video-1';
    const first = await deposit();
    nextId = 'video-2';
    const second = await deposit();

    expect(first.id).not.toBe(second.id);
    expect(first.path).not.toBe(second.path);
    expect(await repo.findByPair('trace-1', 'ref-1')).toHaveLength(2);
  });

  it('supprime le fichier stocké et relance l’erreur quand l’enregistrement échoue', async () => {
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('db down'));

    await expect(deposit()).rejects.toThrow('db down');

    expect(storage.getSaved(MP4_PATH)).toBeUndefined();
  });

  it('garde l’erreur d’origine même si la suppression compensatoire échoue aussi', async () => {
    jest.spyOn(repo, 'save').mockRejectedValue(new Error('db down'));
    jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('storage unreachable'));

    await expect(deposit()).rejects.toThrow('db down');
  });
});
