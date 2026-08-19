export interface ImageSize {
  width: number;
  height: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8]);
const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function pngSize(bytes: Buffer): ImageSize | null {
  if (bytes.length < 24) {
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegSize(bytes: Buffer): ImageSize | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (JPEG_SOF_MARKERS.has(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
}

/**
 * Dimensions natives d'une image, lues dans ses octets. Les minuties sont
 * relevées dans le repère pixel de l'image : sans ces dimensions, aucun marqueur
 * ne peut être replacé sur la planche. TIFF n'est pas couvert — Chromium ne le
 * rend pas non plus.
 */
export function readImageSize(bytes: Buffer): ImageSize | null {
  if (bytes.subarray(0, 4).equals(PNG_SIGNATURE)) {
    return pngSize(bytes);
  }
  if (bytes.subarray(0, 2).equals(JPEG_SIGNATURE)) {
    return jpegSize(bytes);
  }
  return null;
}
