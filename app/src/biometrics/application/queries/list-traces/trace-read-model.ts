import { CaptureQualityProps } from '../../../domain/trace/value-objects/capture-quality.vo';

export interface TraceReadModel {
  id: string;
  path: string;
  status: string;
  score: number | null;
  caseId: string;
  createdAt: Date;
  captureWidth: number | null;
  captureHeight: number | null;
  capturedAt: Date | null;
  captureOrientation: number | null;
  captureFocalLength: number | null;
  captureDeviceModel: string | null;
  captureQuality: CaptureQualityProps | null;
}
