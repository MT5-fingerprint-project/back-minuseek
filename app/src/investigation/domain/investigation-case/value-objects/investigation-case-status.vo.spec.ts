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
    expect(() => InvestigationCaseStatus.from('INVALID')).toThrow(InvalidInvestigationCaseStatusError);
  });

  it('InvestigationCaseStatus.open() retourne OPEN', () => {
    expect(InvestigationCaseStatus.open().getValue()).toBe(InvestigationCaseStatusEnum.OPEN);
  });
});
