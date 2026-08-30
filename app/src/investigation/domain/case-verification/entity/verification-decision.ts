import { DecisionOutcomeEnum } from '../value-objects/decision-outcome.vo';
import {
  VerificationExploitability,
  VerificationExploitabilityEnum,
} from '../value-objects/verification-exploitability.vo';

export interface StateVerificationDecisionProps {
  id: string;
  verificationId: string;
  traceId: string;
  exploitability: VerificationExploitabilityEnum;
  identifiedReferencePrintId: string | null;
}

export interface VerificationDecisionPrimitives {
  id: string;
  verificationId: string;
  traceId: string;
  exploitability: string;
  identifiedReferencePrintId: string | null;
  outcome: DecisionOutcomeEnum | null;
  statedAt: Date;
}

export class VerificationDecision {
  private constructor(
    private readonly _id: string,
    private readonly _verificationId: string,
    private readonly _traceId: string,
    private _exploitability: VerificationExploitability,
    private _identifiedReferencePrintId: string | null,
    private _outcome: DecisionOutcomeEnum | null,
    private _statedAt: Date,
  ) {}

  static state(props: StateVerificationDecisionProps): VerificationDecision {
    return new VerificationDecision(
      props.id,
      props.verificationId,
      props.traceId,
      VerificationExploitability.from(props.exploitability),
      props.identifiedReferencePrintId,
      null,
      new Date(),
    );
  }

  static reconstitute(
    primitives: VerificationDecisionPrimitives,
  ): VerificationDecision {
    return new VerificationDecision(
      primitives.id,
      primitives.verificationId,
      primitives.traceId,
      VerificationExploitability.from(primitives.exploitability),
      primitives.identifiedReferencePrintId,
      primitives.outcome,
      primitives.statedAt,
    );
  }

  restate(
    exploitability: VerificationExploitabilityEnum,
    identifiedReferencePrintId: string | null,
  ): void {
    this._exploitability = VerificationExploitability.from(exploitability);
    this._identifiedReferencePrintId = identifiedReferencePrintId;
    this._outcome = null;
    this._statedAt = new Date();
  }

  confront(outcome: DecisionOutcomeEnum): void {
    this._outcome = outcome;
  }

  toPrimitives(): VerificationDecisionPrimitives {
    return {
      id: this._id,
      verificationId: this._verificationId,
      traceId: this._traceId,
      exploitability: this._exploitability.getValue(),
      identifiedReferencePrintId: this._identifiedReferencePrintId,
      outcome: this._outcome,
      statedAt: this.statedAt,
    };
  }

  get id(): string {
    return this._id;
  }

  get verificationId(): string {
    return this._verificationId;
  }

  get traceId(): string {
    return this._traceId;
  }

  get exploitability(): VerificationExploitabilityEnum {
    return this._exploitability.getValue();
  }

  get identifiedReferencePrintId(): string | null {
    return this._identifiedReferencePrintId;
  }

  get outcome(): DecisionOutcomeEnum | null {
    return this._outcome;
  }

  get statedAt(): Date {
    return new Date(this._statedAt);
  }
}
