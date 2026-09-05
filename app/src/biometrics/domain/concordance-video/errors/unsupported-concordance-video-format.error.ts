export class UnsupportedConcordanceVideoFormatError extends Error {
  constructor() {
    super('Format de vidéo non supporté : MP4 ou WebM attendu');
  }
}
