import {
  InvestigationCaseStatus,
  InvestigationCaseStatusEnum,
  InvalidInvestigationCaseStatusError,
} from './investigation-case-status.vo';

describe('InvestigationCaseStatus', () => {
  it('crée un statut OPEN valide', () => {
    const status = InvestigationCaseStatus.from('OPEN');
    expect(status.getValue()).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it('lève une erreur pour un statut inconnu', () => {
    expect(() => InvestigationCaseStatus.from('INVALID')).toThrow(
      InvalidInvestigationCaseStatusError,
    );
  });

  it('InvestigationCaseStatus.open() retourne OPEN', () => {
    expect(InvestigationCaseStatus.open().getValue()).toBe(
      InvestigationCaseStatusEnum.OPEN,
    );
  });
  it('InvestigationCaseStatus.closed() retourne CLOSED', () => {
    expect(InvestigationCaseStatus.closed().getValue()).toBe(
      InvestigationCaseStatusEnum.CLOSED,
    );
  });

  it('InvestigationCaseStatus.inProgress() retourne IN_PROGRESS', () => {
    expect(InvestigationCaseStatus.inProgress().getValue()).toBe(
      InvestigationCaseStatusEnum.IN_PROGRESS,
    );
  });

  it('ne reconnaît close que le statut CLOSED', () => {
    expect(InvestigationCaseStatus.closed().isClosed()).toBe(true);
    expect(InvestigationCaseStatus.open().isClosed()).toBe(false);
    expect(InvestigationCaseStatus.inProgress().isClosed()).toBe(false);
  });
});
