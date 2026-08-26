import { FileDigest } from '../../file-digest.vo';
import { CaseUnavailableForTraceError } from '../errors/case-unavailable-for-trace.error';
import { RulerNotDetectedError } from '../errors/ruler-not-detected.error';
import { InvalidTraceTransitionError } from '../errors/invalid-trace-transition.error';
import { CaptureMetadata } from '../value-objects/capture-metadata.vo';
import {
  CaptureQuality,
  CaptureQualityProps,
} from '../value-objects/capture-quality.vo';
import { ExploitabilityScore } from '../value-objects/exploitability-score.vo';
import { TraceStatus, TraceStatusEnum } from '../value-objects/trace-status.vo';

const CASE_STATUSES_ACCEPTING_TRACES = ['OPEN', 'IN_PROGRESS'];

export interface TracePrimitives {
  id: string;
  path: string;
  status: TraceStatusEnum;
  score: number | null;
  caseId: string;
  sha256: string | null;
  captureWidth: number | null;
  captureHeight: number | null;
  capturedAt: Date | null;
  captureOrientation: number | null;
  captureFocalLength: number | null;
  captureDeviceModel: string | null;
  captureQuality: CaptureQualityProps | null;
}

interface UploadTraceProps {
  id: string;
  path: string;
  caseId: string;
  sha256: FileDigest;
  captureMetadata?: CaptureMetadata;
  captureQuality?: CaptureQuality;
}

export class Trace {
  private constructor(
    private readonly _id: string,
    private readonly _path: string,
    private _status: TraceStatus,
    private _score: ExploitabilityScore | null,
    private readonly _caseId: string,
    private readonly _sha256: FileDigest | null,
    private readonly _captureMetadata: CaptureMetadata,
    private readonly _captureQuality: CaptureQuality | null,
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

  /**
   * BIO-38 : sans règle millimétrée, aucune échelle — la photo n'est pas
   * exploitable et ne doit pas devenir une trace.
   */
  static assertRulerDetected(detection: {
    present: boolean;
    confidence: number;
  }): void {
    if (!detection.present) {
      throw new RulerNotDetectedError(detection.confidence);
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
      props.sha256,
      props.captureMetadata ?? CaptureMetadata.empty(),
      props.captureQuality ?? null,
    );
  }

  static reconstitute(payload: {
    id: string;
    path: string;
    status: string;
    score: number | null;
    caseId: string;
    sha256: string | null;
    captureWidth: number | null;
    captureHeight: number | null;
    capturedAt: Date | null;
    captureOrientation: number | null;
    captureFocalLength: number | null;
    captureDeviceModel: string | null;
    captureQuality: unknown;
  }): Trace {
    return new Trace(
      payload.id,
      payload.path,
      TraceStatus.from(payload.status),
      payload.score === null ? null : ExploitabilityScore.of(payload.score),
      payload.caseId,
      payload.sha256 === null ? null : FileDigest.from(payload.sha256),
      CaptureMetadata.of({
        width: payload.captureWidth ?? undefined,
        height: payload.captureHeight ?? undefined,
        capturedAt: payload.capturedAt ?? undefined,
        orientation: payload.captureOrientation ?? undefined,
        focalLength: payload.captureFocalLength ?? undefined,
        deviceModel: payload.captureDeviceModel ?? undefined,
      }),
      CaptureQuality.fromPersistence(payload.captureQuality),
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
      sha256: this._sha256?.getValue() ?? null,
      captureWidth: this._captureMetadata.width ?? null,
      captureHeight: this._captureMetadata.height ?? null,
      capturedAt: this._captureMetadata.capturedAt ?? null,
      captureOrientation: this._captureMetadata.orientation ?? null,
      captureFocalLength: this._captureMetadata.focalLength ?? null,
      captureDeviceModel: this._captureMetadata.deviceModel ?? null,
      captureQuality: this._captureQuality?.toPrimitives() ?? null,
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

  get sha256(): string | null {
    return this._sha256?.getValue() ?? null;
  }

  get captureMetadata(): CaptureMetadata {
    return this._captureMetadata;
  }

  get captureQuality(): CaptureQuality | null {
    return this._captureQuality;
  }
}
