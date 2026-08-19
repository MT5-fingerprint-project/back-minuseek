import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { InvalidReportError } from '../errors/invalid-report.error';
import { Report } from './report';

const GENERATED_BY = AuditActor.system('reporting').toPrimitives();
const SEALED_AT = new Date('2026-08-19T08:00:00.000Z');
const SHA256 = 'a'.repeat(64);

function sealProps(overrides: Partial<Parameters<typeof Report.seal>[0]> = {}) {
  return {
    id: 'report-1',
    caseId: 'case-1',
    type: 'TECHNICAL' as const,
    storagePath: 'media/reports/case-1/report-1.pdf',
    sha256: SHA256,
    generatedBy: GENERATED_BY,
    createdAt: SEALED_AT,
    ...overrides,
  };
}

describe('Report', () => {
  it('scelle un rapport et rend ses primitives', () => {
    const report = Report.seal(sealProps());

    expect(report.toPrimitives()).toEqual({
      id: 'report-1',
      caseId: 'case-1',
      type: 'TECHNICAL',
      storagePath: 'media/reports/case-1/report-1.pdf',
      sha256: SHA256,
      generatedBy: GENERATED_BY,
      createdAt: SEALED_AT,
    });
  });

  it("refuse un sha256 qui n'en est pas un", () => {
    expect(() => Report.seal(sealProps({ sha256: 'pas-un-hash' }))).toThrow(
      InvalidReportError,
    );
  });

  it('refuse un sha256 en majuscules', () => {
    expect(() => Report.seal(sealProps({ sha256: 'A'.repeat(64) }))).toThrow(
      InvalidReportError,
    );
  });

  it('refuse un chemin de stockage vide', () => {
    expect(() => Report.seal(sealProps({ storagePath: '  ' }))).toThrow(
      InvalidReportError,
    );
  });

  it('se reconstitue depuis ses primitives', () => {
    const report = Report.reconstitute(sealProps());

    expect(report.sha256).toBe(SHA256);
    expect(report.storagePath).toBe('media/reports/case-1/report-1.pdf');
  });
});
