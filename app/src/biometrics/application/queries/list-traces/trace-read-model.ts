import { CaptureQualityProps } from '../../../domain/trace/value-objects/capture-quality.vo';

export interface TraceReadModel {
  id: string;
  number: number;
  reference: string;
  path: string;
  status: string;
  score: number | null;
  caseId: string;
  identified: boolean;
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
  resolutionDpi: number | null;
}

export type TraceView = Omit<TraceReadModel, 'status' | 'identified'> & {
  url: string;
  status: string | null;
  identified: boolean | null;
};
