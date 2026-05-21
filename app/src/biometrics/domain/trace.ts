import { InvalidTraceTransitionError } from './errors/invalid-trace-transition.error';
import { ExploitabilityScore } from './exploitability-score';
import { TraceStatus } from './trace-status';

export interface TracePrimitives {
  id: string;
  path: string;
  status: TraceStatus;
  score: number | null;
  caseId: string | null;
}

export class Trace {
  private constructor(
    private readonly _id: string,
    private readonly _path: string,
    private _status: TraceStatus,
    private _score: ExploitabilityScore | null,
    private readonly _caseId: string | null,
  ) {}

  static upload(props: { id: string; path: string; caseId?: string }): Trace {
    if (!props.id) {
      throw new Error('Trace id is required');
    }
    if (!props.path) {
      throw new Error('Trace path is required');
    }
    if (props.caseId !== undefined && props.caseId.length === 0) {
      throw new Error('caseId cannot be empty');
    }
    return new Trace(
      props.id,
      props.path,
      TraceStatus.RECEIVED,
      null,
      props.caseId ?? null,
    );
  }

  static reconstitute(primitives: TracePrimitives): Trace {
    return new Trace(
      primitives.id,
      primitives.path,
      primitives.status,
      primitives.score === null
        ? null
        : ExploitabilityScore.of(primitives.score),
      primitives.caseId,
    );
  }

  evaluate(score: ExploitabilityScore): void {
    if (this._status !== TraceStatus.RECEIVED) {
      throw new InvalidTraceTransitionError(this._status, 'evaluate');
    }
    this._score = score;
    this._status = score.isExploitable()
      ? TraceStatus.EXPLOITABLE
      : TraceStatus.NOT_EXPLOITABLE;
  }

  toPrimitives(): TracePrimitives {
    return {
      id: this._id,
      path: this._path,
      status: this._status,
      score: this._score?.toPrimitive() ?? null,
      caseId: this._caseId,
    };
  }

  get id(): string {
    return this._id;
  }

  get path(): string {
    return this._path;
  }

  get status(): TraceStatus {
    return this._status;
  }

  get score(): ExploitabilityScore | null {
    return this._score;
  }

  get caseId(): string | null {
    return this._caseId;
  }
}
