import { assertCaseAcceptsWork } from '../../case-work-window';
import { FileDigest } from '../../file-digest.vo';
import { ImageResolution } from '../../image-resolution.vo';
import { AlreadyWithdrawnError } from '../../withdrawal/errors/already-withdrawn.error';
import { NotWithdrawnError } from '../../withdrawal/errors/not-withdrawn.error';
import { Withdrawal } from '../../withdrawal/withdrawal.vo';
import { InvalidTraceLocationError } from '../errors/invalid-trace-location.error';
import { InvalidTraceTransitionError } from '../errors/invalid-trace-transition.error';
import { CaptureMetadata } from '../value-objects/capture-metadata.vo';
import {
  CaptureQuality,
  CaptureQualityProps,
} from '../value-objects/capture-quality.vo';
import { ExploitabilityScore } from '../value-objects/exploitability-score.vo';
import {
  RevelationTechnique,
  RevelationTechniqueEnum,
} from '../value-objects/revelation-technique.vo';
import { TraceOrigin, TraceOriginEnum } from '../value-objects/trace-origin.vo';
import { TraceStatus, TraceStatusEnum } from '../value-objects/trace-status.vo';

export const MAX_TRACE_LOCATION_LENGTH = 300;

export interface TracePrimitives {
  id: string;
  number: number;
  path: string;
  status: TraceStatusEnum;
  score: number | null;
  caseId: string;
  sha256: string | null;
  displayableSha256: string | null;
  captureWidth: number | null;
  captureHeight: number | null;
  capturedAt: Date | null;
  captureOrientation: number | null;
  captureFocalLength: number | null;
  captureDeviceModel: string | null;
  captureQuality: CaptureQualityProps | null;
  withdrawnAt: Date | null;
  withdrawalMotive: string | null;
  withdrawalMotiveDetail: string | null;
  resolutionDpi: number | null;
  origin: TraceOriginEnum | null;
  location: string | null;
  revelationTechnique: RevelationTechniqueEnum | null;
}

export interface TraceDescription {
  origin: string;
  location: string;
  revelationTechnique: string;
}

interface UploadTraceProps {
  id: string;
  number: number;
  path: string;
  caseId: string;
  sha256: FileDigest;
  displayableSha256?: FileDigest;
  captureMetadata?: CaptureMetadata;
  captureQuality?: CaptureQuality;
  location?: string;
}

function assertLocationFitsColumn(location: string): void {
  if (location.length > MAX_TRACE_LOCATION_LENGTH) {
    throw new InvalidTraceLocationError(
      `elle ne peut pas dépasser ${MAX_TRACE_LOCATION_LENGTH} caractères`,
    );
  }
}

export class Trace {
  private constructor(
    private readonly _id: string,
    private readonly _number: number,
    private readonly _path: string,
    private _status: TraceStatus,
    private _score: ExploitabilityScore | null,
    private readonly _caseId: string,
    private readonly _sha256: FileDigest | null,
    private readonly _displayableSha256: FileDigest | null,
    private readonly _captureMetadata: CaptureMetadata,
    private readonly _captureQuality: CaptureQuality | null,
    private _withdrawal: Withdrawal | null,
    private _resolution: ImageResolution | null,
    private _origin: TraceOrigin | null,
    private _location: string | null,
    private _revelationTechnique: RevelationTechnique | null,
  ) {}

  static assertCaseCanReceiveTrace(
    caseId: string,
    caseStatus: string | null,
  ): void {
    assertCaseAcceptsWork(caseId, caseStatus);
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
    if (!Number.isInteger(props.number) || props.number < 1) {
      throw new Error('Trace number must be a positive integer');
    }
    const location = props.location?.trim() ?? '';
    assertLocationFitsColumn(location);
    return new Trace(
      props.id,
      props.number,
      props.path,
      TraceStatus.received(),
      null,
      props.caseId,
      props.sha256,
      props.displayableSha256 ?? props.sha256,
      props.captureMetadata ?? CaptureMetadata.empty(),
      props.captureQuality ?? null,
      null,
      null,
      null,
      location.length === 0 ? null : location,
      null,
    );
  }

  static reconstitute(payload: {
    id: string;
    number: number;
    path: string;
    status: string;
    score: number | null;
    caseId: string;
    sha256: string | null;
    displayableSha256?: string | null;
    captureWidth: number | null;
    captureHeight: number | null;
    capturedAt: Date | null;
    captureOrientation: number | null;
    captureFocalLength: number | null;
    captureDeviceModel: string | null;
    captureQuality: unknown;
    withdrawnAt: Date | null;
    withdrawalMotive: string | null;
    withdrawalMotiveDetail: string | null;
    resolutionDpi: number | null;
    origin: string | null;
    location: string | null;
    revelationTechnique: string | null;
  }): Trace {
    return new Trace(
      payload.id,
      payload.number,
      payload.path,
      TraceStatus.from(payload.status),
      payload.score === null ? null : ExploitabilityScore.of(payload.score),
      payload.caseId,
      payload.sha256 === null ? null : FileDigest.from(payload.sha256),
      payload.displayableSha256
        ? FileDigest.from(payload.displayableSha256)
        : null,
      CaptureMetadata.of({
        width: payload.captureWidth ?? undefined,
        height: payload.captureHeight ?? undefined,
        capturedAt: payload.capturedAt ?? undefined,
        orientation: payload.captureOrientation ?? undefined,
        focalLength: payload.captureFocalLength ?? undefined,
        deviceModel: payload.captureDeviceModel ?? undefined,
      }),
      CaptureQuality.fromPersistence(payload.captureQuality),
      Withdrawal.fromPersistence(
        payload.withdrawalMotive,
        payload.withdrawnAt,
        payload.withdrawalMotiveDetail,
      ),
      ImageResolution.fromPersistence(payload.resolutionDpi),
      TraceOrigin.fromPersistence(payload.origin),
      payload.location,
      RevelationTechnique.fromPersistence(payload.revelationTechnique),
    );
  }

  calibrate(resolutionDpi: number): void {
    this._resolution = ImageResolution.of(resolutionDpi);
  }

  describe(description: TraceDescription): void {
    const origin = TraceOrigin.from(description.origin);
    const revelationTechnique = RevelationTechnique.from(
      description.revelationTechnique,
    );
    const location = description.location.trim();
    if (location.length === 0) {
      throw new InvalidTraceLocationError('elle ne peut pas être vide');
    }
    assertLocationFitsColumn(location);

    this._origin = origin;
    this._location = location;
    this._revelationTechnique = revelationTechnique;
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

  withdraw(motive: string, at: Date, motiveDetail?: string | null): void {
    if (this._withdrawal !== null) {
      throw new AlreadyWithdrawnError(this._id);
    }
    this._withdrawal = Withdrawal.of(motive, at, motiveDetail);
  }

  restore(): void {
    if (this._withdrawal === null) {
      throw new NotWithdrawnError(this._id);
    }
    this._withdrawal = null;
  }

  toPrimitives(): TracePrimitives {
    return {
      id: this._id,
      number: this._number,
      path: this._path,
      status: this._status.getValue(),
      score: this._score?.getValue() ?? null,
      caseId: this._caseId,
      sha256: this._sha256?.getValue() ?? null,
      displayableSha256: this._displayableSha256?.getValue() ?? null,
      captureWidth: this._captureMetadata.width ?? null,
      captureHeight: this._captureMetadata.height ?? null,
      capturedAt: this._captureMetadata.capturedAt ?? null,
      captureOrientation: this._captureMetadata.orientation ?? null,
      captureFocalLength: this._captureMetadata.focalLength ?? null,
      captureDeviceModel: this._captureMetadata.deviceModel ?? null,
      captureQuality: this._captureQuality?.toPrimitives() ?? null,
      withdrawnAt: this._withdrawal?.getAt() ?? null,
      withdrawalMotive: this._withdrawal?.getMotive() ?? null,
      withdrawalMotiveDetail: this._withdrawal?.getDetail() ?? null,
      resolutionDpi: this._resolution?.getValue() ?? null,
      origin: this._origin?.getValue() ?? null,
      location: this._location,
      revelationTechnique: this._revelationTechnique?.getValue() ?? null,
    };
  }

  get id(): string {
    return this._id;
  }

  get number(): number {
    return this._number;
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

  get displayableSha256(): string | null {
    return this._displayableSha256?.getValue() ?? null;
  }

  get captureMetadata(): CaptureMetadata {
    return this._captureMetadata;
  }

  get captureQuality(): CaptureQuality | null {
    return this._captureQuality;
  }

  get isWithdrawn(): boolean {
    return this._withdrawal !== null;
  }

  get withdrawnAt(): Date | null {
    return this._withdrawal?.getAt() ?? null;
  }

  get withdrawalMotiveDetail(): string | null {
    return this._withdrawal?.getDetail() ?? null;
  }

  get resolutionDpi(): number | null {
    return this._resolution?.getValue() ?? null;
  }

  get origin(): TraceOriginEnum | null {
    return this._origin?.getValue() ?? null;
  }

  get location(): string | null {
    return this._location;
  }

  get revelationTechnique(): RevelationTechniqueEnum | null {
    return this._revelationTechnique?.getValue() ?? null;
  }
}
