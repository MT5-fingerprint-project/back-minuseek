import {
  AuditActor,
  AuditActorPrimitives,
} from '../../../../shared/domain/audit/audit-actor.vo';
import {
  AuditEventType,
  AuditEventTypeEnum,
} from '../../../../shared/domain/audit/audit-event-type.vo';
import {
  EvidenceClass,
  EvidenceClassEnum,
} from '../../../../shared/domain/audit/evidence-class.vo';
import { InvalidAuditEventError } from '../errors/invalid-audit-event.error';

/** Premier maillon d'une chaîne tenant : aucun événement ne le précède. */
export const GENESIS_SEQ = 1n;
export const GENESIS_PREV_HASH = '0'.repeat(64);

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface AuditEventPrimitives {
  id: string;
  seq: bigint;
  eventType: AuditEventTypeEnum;
  evidenceClass: EvidenceClassEnum;
  actor: AuditActorPrimitives;
  caseId: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  prevHash: string;
  hash: string;
}

interface ChainAuditEventProps {
  id: string;
  seq: bigint;
  eventType: AuditEventType;
  evidenceClass: EvidenceClass;
  actor: AuditActor;
  caseId?: string | null;
  traceId?: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  prevHash: string;
  hash: string;
}

function requireHexHash(value: string, field: string): string {
  if (!SHA256_HEX.test(value)) {
    throw new InvalidAuditEventError(
      `"${field}" doit être un SHA-256 hexadécimal minuscule de 64 caractères`,
    );
  }
  return value;
}

function requireOptionalId(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value.trim().length === 0) {
    throw new InvalidAuditEventError(`"${field}" ne peut pas être vide`);
  }
  return value;
}

function requirePayloadObject(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new InvalidAuditEventError('"payload" doit être un objet');
  }
  return structuredClone(payload);
}

/**
 * Maillon de la chaîne d'audit d'un tenant. L'entité est **immuable par construction** : aucune
 * méthode ne la modifie, et les valeurs de référence (payload, date) sont copiées à l'entrée comme
 * à la sortie pour qu'une référence partagée ne puisse pas altérer un événement déjà chaîné.
 *
 * L'entité ne calcule pas son propre `hash` : le hash dépend de la sérialisation canonique
 * (ticket 1.3) et de la tête de chaîne lue sous verrou (ticket 2.2). Elle en garantit seulement la
 * forme.
 */
export class AuditEvent {
  private constructor(
    private readonly _id: string,
    private readonly _seq: bigint,
    private readonly _eventType: AuditEventType,
    private readonly _evidenceClass: EvidenceClass,
    private readonly _actor: AuditActor,
    private readonly _caseId: string | null,
    private readonly _traceId: string | null,
    private readonly _payload: Record<string, unknown>,
    private readonly _occurredAt: Date,
    private readonly _prevHash: string,
    private readonly _hash: string,
  ) {}

  static chain(props: ChainAuditEventProps): AuditEvent {
    if (props.id.trim().length === 0) {
      throw new InvalidAuditEventError('"id" est requis');
    }
    if (props.seq < GENESIS_SEQ) {
      throw new InvalidAuditEventError(`"seq" démarre à ${GENESIS_SEQ}`);
    }
    if (Number.isNaN(props.occurredAt.getTime())) {
      throw new InvalidAuditEventError(
        '"occurredAt" n\'est pas une date valide',
      );
    }
    return new AuditEvent(
      props.id,
      props.seq,
      props.eventType,
      props.evidenceClass,
      props.actor,
      requireOptionalId(props.caseId, 'caseId'),
      requireOptionalId(props.traceId, 'traceId'),
      requirePayloadObject(props.payload),
      new Date(props.occurredAt.getTime()),
      requireHexHash(props.prevHash, 'prevHash'),
      requireHexHash(props.hash, 'hash'),
    );
  }

  static reconstitute(primitives: AuditEventPrimitives): AuditEvent {
    return AuditEvent.chain({
      ...primitives,
      eventType: AuditEventType.from(primitives.eventType),
      evidenceClass: EvidenceClass.from(primitives.evidenceClass),
      actor: AuditActor.reconstitute(primitives.actor),
    });
  }

  isGenesis(): boolean {
    return this._seq === GENESIS_SEQ && this._prevHash === GENESIS_PREV_HASH;
  }

  toPrimitives(): AuditEventPrimitives {
    return {
      id: this._id,
      seq: this._seq,
      eventType: this._eventType.getValue(),
      evidenceClass: this._evidenceClass.getValue(),
      actor: this._actor.toPrimitives(),
      caseId: this._caseId,
      traceId: this._traceId,
      payload: structuredClone(this._payload),
      occurredAt: new Date(this._occurredAt.getTime()),
      prevHash: this._prevHash,
      hash: this._hash,
    };
  }

  get id(): string {
    return this._id;
  }

  get seq(): bigint {
    return this._seq;
  }

  get eventType(): AuditEventTypeEnum {
    return this._eventType.getValue();
  }

  get evidenceClass(): EvidenceClassEnum {
    return this._evidenceClass.getValue();
  }

  get actor(): AuditActor {
    return this._actor;
  }

  get caseId(): string | null {
    return this._caseId;
  }

  get traceId(): string | null {
    return this._traceId;
  }

  get payload(): Record<string, unknown> {
    return structuredClone(this._payload);
  }

  get occurredAt(): Date {
    return new Date(this._occurredAt.getTime());
  }

  get prevHash(): string {
    return this._prevHash;
  }

  get hash(): string {
    return this._hash;
  }
}
