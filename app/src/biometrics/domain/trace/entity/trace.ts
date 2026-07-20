import { CaseUnavailableForTraceError } from '../errors/case-unavailable-for-trace.error';
import { InvalidTraceTransitionError } from '../errors/invalid-trace-transition.error';
import { ExploitabilityScore } from '../value-objects/exploitability-score.vo';
import { TraceStatus, TraceStatusEnum } from '../value-objects/trace-status.vo';

const CASE_STATUSES_ACCEPTING_TRACES = ['OPEN', 'IN_PROGRESS'];

export interface TracePrimitives {
  id: string;
  path: string;
  status: TraceStatusEnum;
  score: number | null;
  caseId: string;
}

interface UploadTraceProps {
  id: string;
  path: string;
  caseId: string;
}

export class Trace {
  private constructor(
    private readonly _id: string,
    private readonly _path: string,
    private _status: TraceStatus,
    private _score: ExploitabilityScore | null,
    private readonly _caseId: string,
  ) {}

  static assertCaseCanReceiveTrace(
    caseId: string,
    caseStatus: string | null,
  ): void {
    if (
      caseStatus === null ||
      !CASE_STATUSES_ACCEPTING_TRACES.includes(caseStatus)
    ) {
      throw new CaseUnavailableForTraceError(caseId);
    }
  }

  static upload(props: UploadTraceProps): Trace {
    if (!props.id) {
      throw new Error('Trace id is required');
    }
    if (!props.path) {
      throw new Error('Trace path is required');
    }
    if (!props.caseId) {
      throw new Error('Trace caseId is required');
    }
    return new Trace(
      props.id,
      props.path,
      TraceStatus.received(),
      null,
      props.caseId,
    );
  }

  static reconstitute(payload: {
    id: string;
    path: string;
    status: string;
    score: number | null;
    caseId: string;
  }): Trace {
    return new Trace(
      payload.id,
      payload.path,
      TraceStatus.from(payload.status),
      payload.score === null ? null : ExploitabilityScore.of(payload.score),
      payload.caseId,
    );
  }

  evaluate(score: ExploitabilityScore): void {
    if (this._status.getValue() !== TraceStatusEnum.RECEIVED) {
      throw new InvalidTraceTransitionError(this._status, 'evaluate');
    }
    this._score = score;
    this._status = score.isExploitable()
      ? TraceStatus.exploitable()
      : TraceStatus.notExploitable();
  }

  toPrimitives(): TracePrimitives {
    return {
      id: this._id,
      path: this._path,
      status: this._status.getValue(),
      score: this._score?.getValue() ?? null,
      caseId: this._caseId,
    };
  }

  get id(): string {
    return this._id;
  }

  get path(): string {
    return this._path;
  }

  get status(): TraceStatusEnum {
    return this._status.getValue();
  }

  get score(): number | null {
    return this._score?.getValue() ?? null;
  }

  get caseId(): string {
    return this._caseId;
  }
}
