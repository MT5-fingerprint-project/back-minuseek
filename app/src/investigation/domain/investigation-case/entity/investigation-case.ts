import { InvestigationCaseStatus } from '../value-objects/investigation-case-status.vo';

interface OpenInvestigationCaseProps {
  id: string;
  caseNumber: string;
  pvNumber: string;
  operatorId: string;
  description?: string;
}

export class InvestigationCase {
  private constructor(
    private readonly _id: string,
    private readonly _caseNumber: string,
    private readonly _pvNumber: string,
    private readonly _operatorId: string,
    private readonly _description: string | undefined,
    private _status: InvestigationCaseStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: OpenInvestigationCaseProps): InvestigationCase {
    const now = new Date();
    return new InvestigationCase(
      props.id,
      props.caseNumber,
      props.pvNumber,
      props.operatorId,
      props.description,
      InvestigationCaseStatus.open(),
      now,
      now,
    );
  }

  get id() {
    return this._id;
  }

  get caseNumber() {
    return this._caseNumber;
  }

  get pvNumber() {
    return this._pvNumber;
  }

  get operatorId() {
    return this._operatorId;
  }

  get description() {
    return this._description;
  }

  get status() {
    return this._status.getValue();
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }
}
