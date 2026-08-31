import {
  BadRequestException,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common';
import type { FileValidator } from '@nestjs/common';

export const IMAGE_MIME = /^image\/(png|jpe?g|tiff)$/;
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export const imageValidators = (): FileValidator[] => [
  new FileTypeValidator({ fileType: IMAGE_MIME }),
  new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES }),
];

export const imageFileValidator = () =>
  new ParseFilePipe({ validators: imageValidators(), fileIsRequired: true });

// `ParseFilePipe` ne valide qu'un fichier ou un tableau de fichiers : avec
// `FileFieldsInterceptor` il reçoit un objet de champs et le laisse filer.
// `FileTypeValidator.isValid` lit les octets de tête, donc rend une promesse.
export async function assertUsableImage(file: UploadedImage): Promise<void> {
  for (const validator of imageValidators()) {
    if (!(await validator.isValid(file))) {
      throw new BadRequestException(validator.buildErrorMessage(file));
    }
  }
}
