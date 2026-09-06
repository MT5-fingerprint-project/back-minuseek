import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import type { FileValidator } from '@nestjs/common';

export const VIDEO_MIME = /^video\/(mp4|webm)$/;
/**
 * Aligné sur ce que la page publique de vérification sait hacher dans le
 * navigateur (`MAX_VERIFIABLE_BYTES`) : déposer une vidéo qu'un magistrat ne
 * pourrait pas vérifier n'aurait aucun sens. À 8 Mbit/s, une démonstration de
 * vingt paires jouée à 0,5× dépasse déjà le plafond des images.
 */
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export interface UploadedVideo {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export const videoValidators = (): FileValidator[] => [
  new FileTypeValidator({ fileType: VIDEO_MIME }),
  new MaxFileSizeValidator({ maxSize: MAX_VIDEO_SIZE_BYTES }),
];

export const videoFileValidator = () =>
  new ParseFilePipe({ validators: videoValidators(), fileIsRequired: true });
