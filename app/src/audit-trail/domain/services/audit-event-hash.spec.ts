import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import { GENESIS_PREV_HASH } from '../audit-event/entity/audit-event';
import { AuditEventHashInput, computeEventHash } from './audit-event-hash';
import { CanonicalizationError } from './canonical-json';

const SHA256_HEX = /^[0-9a-f]{64}$/;

function genesisInput(): AuditEventHashInput {
  return {
    seq: 1n,
    eventType: AuditEventTypeEnum.TENANT_PROVISIONED,
    evidenceClass: EvidenceClassEnum.OBSERVED,
    actor: AuditActor.system('provisioner'),
    caseId: null,
    traceId: null,
    payload: { slug: 'tenant-demo', displayName: 'Tenant Démo' },
    occurredAt: new Date('2026-08-02T10:00:00.000Z'),
    prevHash: GENESIS_PREV_HASH,
  };
}

describe('computeEventHash', () => {
  describe('golden vectors — figés à VIE (les changer romprait toute chaîne existante)', () => {
    it('vecteur 1 : genesis TENANT_PROVISIONED', () => {
      expect(computeEventHash(genesisInput())).toBe(
        '0dca3534e11be74fe0c1f0832cf58230f1ce103f57b653ab42735ad12e4867a3',
      );
    });

    it('vecteur 2 : événement métier avec unicode, flottant et payload imbriqué', () => {
      const hash = computeEventHash({
        seq: 42n,
        eventType: AuditEventTypeEnum.LAYER_UPDATED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: AuditActor.user({
          sub: '3f2c8a10-9d4e-4b7a-8a2e-5c1d9e0f6b3a',
          username: 'a.durand',
          displayName: 'Agnès Durand — PTS Lyon',
        }),
        caseId: '7a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9',
        traceId: '0f9e8d7c-6b5a-4938-2716-05f4e3d2c1b0',
        payload: {
          layerId: 'c0ffee00-1234-5678-9abc-def012345678',
          settings: { opacity: 0.75, brightness: -12.5, blend: 'écran' },
          zIndex: 3,
        },
        occurredAt: new Date('2026-08-05T14:30:15.123Z'),
        prevHash:
          'a3f5b8c2d1e4067f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f',
      });
      expect(hash).toBe(
        '0e21e96479884b2d4e400cb761c4b0e5ad657fa3cb142bd755deec75379f1f3c',
      );
    });

    it('vecteur 3 : événement DECLARED sans dossier ni trace (null explicites)', () => {
      const hash = computeEventHash({
        seq: 7n,
        eventType: AuditEventTypeEnum.HIT_RECORDED,
        evidenceClass: EvidenceClassEnum.DECLARED,
        actor: AuditActor.user({
          sub: 'sub-1',
          username: 'viewer',
          displayName: 'Viewer',
        }),
        caseId: null,
        traceId: null,
        payload: {},
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        prevHash: GENESIS_PREV_HASH,
      });
      expect(hash).toBe(
        '0032a62c1d29868ed0b76f1a736ebabf6b6e7aaba8101c137750c601894432b5',
      );
    });
  });

  describe('stabilité', () => {
    it('produit un SHA-256 hex minuscule de 64 caractères', () => {
      expect(computeEventHash(genesisInput())).toMatch(SHA256_HEX);
    });

    it("est insensible à l'ordre d'insertion des clés du payload", () => {
      const a = genesisInput();
      a.payload = { slug: 'tenant-demo', displayName: 'Tenant Démo' };
      const b = genesisInput();
      b.payload = { displayName: 'Tenant Démo', slug: 'tenant-demo' };
      expect(computeEventHash(a)).toBe(computeEventHash(b));
    });

    it('est déterministe entre deux appels', () => {
      expect(computeEventHash(genesisInput())).toBe(
        computeEventHash(genesisInput()),
      );
    });

    it('deux Date au même instant donnent le même hash', () => {
      const a = genesisInput();
      a.occurredAt = new Date('2026-08-02T10:00:00.000Z');
      const b = genesisInput();
      b.occurredAt = new Date(Date.UTC(2026, 7, 2, 10, 0, 0, 0));
      expect(computeEventHash(a)).toBe(computeEventHash(b));
    });
  });

  describe('sensibilité — chaque champ couvert fait varier le hash', () => {
    const reference = computeEventHash(genesisInput());

    it.each<[string, (input: AuditEventHashInput) => void]>([
      ['seq', (input) => void (input.seq = 2n)],
      [
        'eventType',
        (input) => void (input.eventType = AuditEventTypeEnum.CASE_OPENED),
      ],
      [
        'evidenceClass',
        (input) => void (input.evidenceClass = EvidenceClassEnum.DECLARED),
      ],
      [
        'actor',
        (input) => void (input.actor = AuditActor.system('other-system')),
      ],
      [
        'caseId',
        (input) => void (input.caseId = '7a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9'),
      ],
      [
        'payload',
        (input) => void (input.payload = { slug: 'tenant-demo-altéré' }),
      ],
      [
        'occurredAt (à la milliseconde)',
        (input) =>
          void (input.occurredAt = new Date('2026-08-02T10:00:00.001Z')),
      ],
      ['prevHash', (input) => void (input.prevHash = 'f'.repeat(64))],
    ])('%s modifié → hash différent', (_field, mutate) => {
      const mutated = genesisInput();
      mutate(mutated);
      expect(computeEventHash(mutated)).not.toBe(reference);
    });
  });

  describe('entrées invalides', () => {
    it('rejette une date invalide', () => {
      const input = genesisInput();
      input.occurredAt = new Date('pas-une-date');
      expect(() => computeEventHash(input)).toThrow(CanonicalizationError);
    });

    it('rejette un payload non canonicalisable (Date imbriquée)', () => {
      const input = genesisInput();
      input.payload = { at: new Date() };
      expect(() => computeEventHash(input)).toThrow(CanonicalizationError);
    });
  });
});
