export enum InvestigationCaseStatusEnum {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CLOSED = 'CLOSED',
}

export class InvalidInvestigationCaseStatusError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un statut valide`);
  }
}

export class InvestigationCaseStatus {
  private constructor(private readonly value: InvestigationCaseStatusEnum) {}

  static from(raw: string): InvestigationCaseStatus {
    if (!Object.values(InvestigationCaseStatusEnum).includes(raw as InvestigationCaseStatusEnum)) {
      throw new InvalidInvestigationCaseStatusError(raw);
    }
    return new InvestigationCaseStatus(raw as InvestigationCaseStatusEnum);
  }

  static open(): InvestigationCaseStatus {
    return new InvestigationCaseStatus(InvestigationCaseStatusEnum.OPEN);
  }

  getValue(): InvestigationCaseStatusEnum {
    return this.value;
  }
}
