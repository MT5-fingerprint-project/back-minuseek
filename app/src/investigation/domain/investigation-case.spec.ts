import { InvestigationCase } from './investigation-case';
import { InvestigationCaseStatusEnum } from './investigation-case-status.vo';

describe('InvestigationCase', () => {
  it('ouvre un case avec status OPEN', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
    });
    expect(c.status).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it('initialise createdAt et updatedAt', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
    });
    expect(c.createdAt).toBeInstanceOf(Date);
    expect(c.updatedAt).toBeInstanceOf(Date);
  });

  it('expose les propriétés passées en entrée', () => {
    const c = InvestigationCase.open({
      id: 'uuid-test',
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      description: 'Un test',
    });
    expect(c.id).toBe('uuid-test');
    expect(c.caseNumber).toBe('AFF-001');
    expect(c.description).toBe('Un test');
  });
});
