import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { InvalidReportError } from '../errors/invalid-report.error';
import { Report } from './report';

const GENERATED_BY = AuditActor.system('reporting').toPrimitives();
const SEALED_AT = new Date('2026-08-19T08:00:00.000Z');
const SHA256 = 'a'.repeat(64);
const SIGNER_ID = '3f2b1c40-0000-4000-8000-000000000001';

function sealProps(overrides: Partial<Parameters<typeof Report.seal>[0]> = {}) {
  return {
    id: 'report-1',
    caseId: 'case-1',
    type: 'TECHNICAL' as const,
    sequence: 1,
    number: '3455-R1',
    signerUserId: SIGNER_ID,
    journalDetail: 'SUMMARY' as const,
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
      sequence: 1,
      number: '3455-R1',
      signerUserId: SIGNER_ID,
      journalDetail: 'SUMMARY',
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

  it('refuse un numéro vide : le document imprime ce texte, il ne peut pas être blanc', () => {
    expect(() => Report.seal(sealProps({ number: '  ' }))).toThrow(
      InvalidReportError,
    );
  });

  it('refuse un signataire vide : personne ne signerait le document', () => {
    expect(() => Report.seal(sealProps({ signerUserId: '' }))).toThrow(
      InvalidReportError,
    );
  });

  it.each([0, -1, 1.5])('refuse une séquence qui vaut %p', (sequence) => {
    expect(() => Report.seal(sealProps({ sequence }))).toThrow(
      InvalidReportError,
    );
  });

  it('accepte la première séquence du dossier', () => {
    expect(Report.seal(sealProps({ sequence: 1 })).number).toBe('3455-R1');
  });

  it('scelle la variante de journal demandée : elle ne se rejoue pas', () => {
    const report = Report.seal(sealProps({ journalDetail: 'FULL' }));

    expect(report.toPrimitives().journalDetail).toBe('FULL');
  });

  it('se reconstitue depuis ses primitives', () => {
    const report = Report.reconstitute(
      sealProps({ sequence: 4, number: '3455-R4' }),
    );

    expect(report.sha256).toBe(SHA256);
    expect(report.storagePath).toBe('media/reports/case-1/report-1.pdf');
    expect(report.sequence).toBe(4);
    expect(report.number).toBe('3455-R4');
  });
});
