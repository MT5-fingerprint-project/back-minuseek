import { AuditEventType, AuditEventTypeEnum } from './audit-event-type.vo';

/**
 * Frozen catalogue of audit event types, written in literals and **never derived from the enum**: a list built from
 * `AuditEventTypeEnum` would compare to itself and let a renamed value slip through,
 * which is precisely what would break the verifiability of already chained events.
 * Adding a type = adding its line here, deliberately. Removing or renaming = forbidden.
 *
 */

const FROZEN_CATALOGUE = [
  'TENANT_PROVISIONED',
  'CASE_OPENED',
  'CASE_STATUS_CHANGED',
  'TRACE_UPLOADED',
  'TRACE_QUALIFIED',
  'TRACE_DELETED',
  'REFERENCE_PRINT_UPLOADED',
  'REFERENCE_PRINT_DELETED',
  'LAYER_CREATED',
  'LAYER_UPDATED',
  'LAYER_DELETED',
  'COMPARISON_EXECUTED',
  'HIT_RECORDED',
  'HIT_REMOVED',
  'REPORT_GENERATED',
  'CHAIN_ANCHORED',
];

describe('AuditEventType', () => {
  it('parses a type of the catalogue', () => {
    expect(AuditEventType.from('TRACE_UPLOADED').getValue()).toBe(
      AuditEventTypeEnum.TRACE_UPLOADED,
    );
  });

  it('rejects a type outside the catalogue', () => {
    expect(() => AuditEventType.from('TRACE_LOOKED_AT')).toThrow();
  });

  it('freezes the whole catalogue: nothing removed, nothing renamed, nothing added by accident', () => {
    expect([...Object.values(AuditEventTypeEnum)].sort()).toEqual(
      [...FROZEN_CATALOGUE].sort(),
    );
  });

  it('stores each type under its own name', () => {
    for (const [key, value] of Object.entries(AuditEventTypeEnum)) {
      expect(value).toBe(key);
    }
  });

  it('compares by value', () => {
    expect(
      AuditEventType.from('CASE_OPENED').equals(
        AuditEventType.from('CASE_OPENED'),
      ),
    ).toBe(true);
  });
});
