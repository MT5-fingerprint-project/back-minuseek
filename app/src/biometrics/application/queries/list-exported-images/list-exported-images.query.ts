export class ListExportedImagesQuery {
  constructor(
    public readonly caseId: string,
    public readonly sourcePieceId: string,
  ) {}
}
