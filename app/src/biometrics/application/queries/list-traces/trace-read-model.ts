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
}
