import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  ImageConverterPort,
  InvalidImageError,
} from '../../application/ports/image-converter.port';

// Le plus grand consommateur front restant est l'emplacement d'empreinte de la
// fiche sujet : carré et fluide dans une grille, sa largeur rendue suit celle de
// la page, donc aucune taille fixe ne la borne. 640 px lui laisse de la marge sur
// un écran à haute densité, pour un poids négligeable devant l'original ; les
// autres vues (carrousel 73x107 CSS, tableaux 48 px) sont bien en dessous.
const THUMBNAIL_MAX_SIDE_PX = 640;
const THUMBNAIL_QUALITY = 80;

@Injectable()
export class SharpImageConverterAdapter implements ImageConverterPort {
  async tiffToPng(tiff: Buffer): Promise<Buffer> {
    try {
      // L'encodage PNG est lossless : seul le format change, pas les pixels.
      return await sharp(tiff).png().toBuffer();
    } catch {
      throw new InvalidImageError();
    }
  }

  async toDisplayThumbnail(source: Buffer): Promise<Buffer> {
    try {
      return await sharp(source)
        // WebP ne transporte pas le tag d'orientation : sans redressement les
        // pixels partiraient couchés là où l'original s'affiche debout.
        .autoOrient()
        .resize(THUMBNAIL_MAX_SIDE_PX, THUMBNAIL_MAX_SIDE_PX, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: THUMBNAIL_QUALITY })
        .toBuffer();
    } catch {
      throw new InvalidImageError();
    }
  }
}
