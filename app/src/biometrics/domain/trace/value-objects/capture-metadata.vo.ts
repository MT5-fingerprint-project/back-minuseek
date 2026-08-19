import { InvalidCaptureMetadataError } from '../errors/invalid-capture-metadata.error';

export const MAX_DEVICE_MODEL_LENGTH = 120;

export interface CaptureMetadataProps {
  width?: number;
  height?: number;
  capturedAt?: string | Date;
  orientation?: number;
  focalLength?: number;
  deviceModel?: string;
}

export class CaptureMetadata {
  private constructor(
    private readonly _width: number | undefined,
    private readonly _height: number | undefined,
    private readonly _capturedAt: Date | undefined,
    private readonly _orientation: number | undefined,
    private readonly _focalLength: number | undefined,
    private readonly _deviceModel: string | undefined,
  ) {}

  static of(props: CaptureMetadataProps): CaptureMetadata {
    assertPixelCount('width', props.width);
    assertPixelCount('height', props.height);
    if ((props.width === undefined) !== (props.height === undefined)) {
      throw new InvalidCaptureMetadataError(
        'width et height doivent être fournis ensemble',
      );
    }
    assertExifOrientation(props.orientation);
    assertFocalLength(props.focalLength);
    return new CaptureMetadata(
      props.width,
      props.height,
      toCaptureDate(props.capturedAt),
      props.orientation,
      props.focalLength,
      toDeviceModel(props.deviceModel),
    );
  }

  static empty(): CaptureMetadata {
    return new CaptureMetadata(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  }

  get width(): number | undefined {
    return this._width;
  }

  get height(): number | undefined {
    return this._height;
  }

  get capturedAt(): Date | undefined {
    return this._capturedAt === undefined
      ? undefined
      : new Date(this._capturedAt);
  }

  get orientation(): number | undefined {
    return this._orientation;
  }

  get focalLength(): number | undefined {
    return this._focalLength;
  }

  get deviceModel(): string | undefined {
    return this._deviceModel;
  }
}

function assertPixelCount(field: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidCaptureMetadataError(
      `${field} doit être un entier de pixels supérieur ou égal à 1 (reçu : ${value})`,
    );
  }
}

function assertExifOrientation(value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new InvalidCaptureMetadataError(
      `orientation doit être une valeur EXIF entière entre 1 et 8 (reçu : ${value})`,
    );
  }
}

function assertFocalLength(value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidCaptureMetadataError(
      `focalLength doit être un nombre de millimètres strictement positif (reçu : ${value})`,
    );
  }
}

function toCaptureDate(value: string | Date | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidCaptureMetadataError(
      `capturedAt doit être une date exploitable (reçu : ${String(value)})`,
    );
  }
  return date;
}

function toDeviceModel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length === 0 || trimmed.length > MAX_DEVICE_MODEL_LENGTH) {
    throw new InvalidCaptureMetadataError(
      `deviceModel doit contenir entre 1 et ${MAX_DEVICE_MODEL_LENGTH} caractères`,
    );
  }
  return trimmed;
}
