export class UnsupportedExportFormatError extends Error {
  constructor() {
    super("Format d'image non supporté : PNG ou JPEG attendu");
  }
}
