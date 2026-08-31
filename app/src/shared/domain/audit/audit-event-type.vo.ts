/**
 * Audit trail catalogue of event types.
 * a missing type can't be chained.
 * Adding a type is coded with the corresponding business feature.
 * NEVER replace or deelete a value or it will break the verifiability of already chained events.
 * Mutation test cover this class, so any change will break the tests. update the tests if you add a new type.
 */
export enum AuditEventTypeEnum {
  TENANT_PROVISIONED = 'TENANT_PROVISIONED',
  CASE_OPENED = 'CASE_OPENED',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  CASE_OPERATOR_CHANGED = 'CASE_OPERATOR_CHANGED',
  CASE_UPDATED = 'CASE_UPDATED',
  CASE_EXPERTISE_DECLARED = 'CASE_EXPERTISE_DECLARED',
  CASE_SAISINE_UPDATED = 'CASE_SAISINE_UPDATED',
  SUBJECT_REGISTERED = 'SUBJECT_REGISTERED',
  TRACE_UPLOADED = 'TRACE_UPLOADED',
  TRACE_QUALIFIED = 'TRACE_QUALIFIED',
  TRACE_DELETED = 'TRACE_DELETED',
  REFERENCE_PRINT_UPLOADED = 'REFERENCE_PRINT_UPLOADED',
  REFERENCE_PRINT_DELETED = 'REFERENCE_PRINT_DELETED',
  TRACE_RESTORED = 'TRACE_RESTORED',
  REFERENCE_PRINT_RESTORED = 'REFERENCE_PRINT_RESTORED',
  REFERENCE_PRINT_IMAGE_DESTROYED = 'REFERENCE_PRINT_IMAGE_DESTROYED',
  LAYER_CREATED = 'LAYER_CREATED',
  LAYER_UPDATED = 'LAYER_UPDATED',
  LAYER_DELETED = 'LAYER_DELETED',
  COMPARISON_EXECUTED = 'COMPARISON_EXECUTED',
  HIT_RECORDED = 'HIT_RECORDED',
  HIT_REMOVED = 'HIT_REMOVED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  CHAIN_ANCHORED = 'CHAIN_ANCHORED',
  SERVICE_HEADER_SAVED = 'SERVICE_HEADER_SAVED',
  TRACE_CALIBRATED = 'TRACE_CALIBRATED',
  REFERENCE_PRINT_CALIBRATED = 'REFERENCE_PRINT_CALIBRATED',
  CASE_VERIFICATION_REQUESTED = 'CASE_VERIFICATION_REQUESTED',
  VERIFICATION_CONCLUSION_STATED = 'VERIFICATION_CONCLUSION_STATED',
  CASE_VERIFICATION_COMPLETED = 'CASE_VERIFICATION_COMPLETED',
  TRACE_DESCRIBED = 'TRACE_DESCRIBED',
  TRACE_LOCATION_STATED = 'TRACE_LOCATION_STATED',
  LOCATION_PHOTO_UPLOADED = 'LOCATION_PHOTO_UPLOADED',
  LOCATION_PHOTO_DELETED = 'LOCATION_PHOTO_DELETED',
  EXPORTED_IMAGE_DEPOSITED = 'EXPORTED_IMAGE_DEPOSITED',
}

export class InvalidAuditEventTypeError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un type d'événement d'audit connu`);
  }
}

function isAuditEventType(raw: string): raw is AuditEventTypeEnum {
  return (Object.values(AuditEventTypeEnum) as string[]).includes(raw);
}

export class AuditEventType {
  private constructor(private readonly value: AuditEventTypeEnum) {}

  static from(raw: string): AuditEventType {
    if (!isAuditEventType(raw)) {
      throw new InvalidAuditEventTypeError(raw);
    }
    return new AuditEventType(raw);
  }

  getValue(): AuditEventTypeEnum {
    return this.value;
  }

  equals(other: AuditEventType): boolean {
    return this.value === other.value;
  }
}
