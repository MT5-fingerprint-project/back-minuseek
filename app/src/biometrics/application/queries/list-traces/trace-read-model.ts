import { CaptureQualityProps } from '../../../domain/trace/value-objects/capture-quality.vo';

export interface TraceReadModel {
  id: string;
  number: number;
  reference: string;
  path: string;
  status: string;
  cote: string | null;
  caseId: string;
  identified: boolean;
  notIdentified: boolean;
  sha256: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  origin: string | null;
  location: string | null;
  revelationTechnique: string | null;
  hasLocationPhoto: boolean;
  thumbPath: string | null;
}

export interface TraceLocationPhotoReadModel {
  id: string;
  path: string;
  sha256: string;
  thumbPath: string | null;
  sealedAt: Date;
}

export interface TraceDetailReadModel extends TraceReadModel {
  locationPhoto: TraceLocationPhotoReadModel | null;
}

export type TraceView = Omit<
  TraceReadModel,
  'status' | 'identified' | 'notIdentified'
> & {
  url: string;
  thumbUrl: string | null;
  status: string | null;
  identified: boolean | null;
  notIdentified: boolean | null;
};

export interface TraceLocationPhotoView {
  id: string;
  url: string;
  thumbUrl: string | null;
  sha256: string;
  sealedAt: Date;
}

export type TraceDetailView = TraceView & {
  locationPhoto: TraceLocationPhotoView | null;
};
