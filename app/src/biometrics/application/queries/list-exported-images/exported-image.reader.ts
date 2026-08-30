import { ExportedImageReadModel } from './exported-image-read-model';

export interface ExportedImageReader {
  findBySourcePieceId(sourcePieceId: string): Promise<ExportedImageReadModel[]>;
}

export const EXPORTED_IMAGE_READER = 'ExportedImageReader';
