import {
  AuditEventDraft,
  AuditLink,
} from '../../../../shared/domain/ports/audit-trail.port';
import { ExportedImage } from '../entity/exported-image';

export interface ExportedImageRepository {
  save(image: ExportedImage, act: AuditEventDraft): Promise<AuditLink>;
  findBySourcePieceId(sourcePieceId: string): Promise<ExportedImage[]>;
}

export const EXPORTED_IMAGE_REPOSITORY = 'ExportedImageRepository';
