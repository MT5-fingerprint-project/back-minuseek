export interface ExportedImageReadModel {
  id: string;
  sourcePieceId: string;
  sourceKind: 'TRACE' | 'REFERENCE_PRINT';
  path: string;
  sha256: string;
  createdAt: Date;
}

export type ExportedImageView = Omit<ExportedImageReadModel, 'path'> & {
  url: string;
};
