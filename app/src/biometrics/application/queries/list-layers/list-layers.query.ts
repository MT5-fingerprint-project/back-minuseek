export class ListLayersQuery {
  constructor(
    public readonly fingerprintId: string,
    public readonly blindVerifierUserId: string | null = null,
  ) {}
}
