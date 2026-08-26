import { InvestigationCase } from './investigation-case';
import { InvestigationCaseStatusEnum } from '../value-objects/investigation-case-status.vo';
import { CaseClosedError } from '../errors/case-closed.error';

const OPENED_BY = 'user-marie';
const HANDED_TO = 'user-pierre';

function anOpenCase() {
  return InvestigationCase.open({
    id: 'uuid-test',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2024-001',
    operatorUserId: OPENED_BY,
  });
}

function aClosedCase() {
  return InvestigationCase.reconstitute({
    id: 'uuid-test',
    caseNumber: 'AFF-001',
    pvNumber: 'PV-2024-001',
    description: null,
    status: InvestigationCaseStatusEnum.CLOSED,
    operatorUserId: OPENED_BY,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  });
}

describe('InvestigationCase', () => {
  it('ouvre un case avec status OPEN', () => {
    expect(anOpenCase().status).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it('initialise createdAt et updatedAt', () => {
    const c = anOpenCase();
    expect(c.createdAt).toBeInstanceOf(Date);
    expect(c.updatedAt).toBeInstanceOf(Date);
  });

  it('expose les propriétés passées en entrée', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: 'Un test',
      operatorUserId: OPENED_BY,
    });
    expect(c.id).toBe('uuid-test');
    expect(c.caseNumber).toBe('AFF-001');
    expect(c.description).toBe('Un test');
  });

  it("fait de celui qui ouvre l'affaire son opérateur", () => {
    expect(anOpenCase().operatorUserId).toBe(OPENED_BY);
  });

  it("rend l'opérateur enregistré quand on relit une affaire", () => {
    expect(aClosedCase().operatorUserId).toBe(OPENED_BY);
  });

  it('relit une affaire sans opérateur sans lui en inventer un', () => {
    const c = InvestigationCase.reconstitute({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: null,
      status: InvestigationCaseStatusEnum.OPEN,
      operatorUserId: null,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });
    expect(c.operatorUserId).toBeNull();
  });

  it("remplace l'opérateur en place, qui n'est jamais deux", () => {
    const c = anOpenCase();

    c.changeOperator(HANDED_TO);

    expect(c.operatorUserId).toBe(HANDED_TO);
  });

  it("date la modification quand l'opérateur change", () => {
    const c = InvestigationCase.reconstitute({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: null,
      status: InvestigationCaseStatusEnum.OPEN,
      operatorUserId: OPENED_BY,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
    });

    c.changeOperator(HANDED_TO);

    expect(c.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T10:00:00Z').getTime(),
    );
  });

  it("refuse de changer l'opérateur d'une affaire close", () => {
    expect(() => aClosedCase().changeOperator(HANDED_TO)).toThrow(
      CaseClosedError,
    );
  });

  it("laisse l'opérateur en place quand l'affaire est close", () => {
    const c = aClosedCase();

    expect(() => c.changeOperator(HANDED_TO)).toThrow(CaseClosedError);
    expect(c.operatorUserId).toBe(OPENED_BY);
  });
});
