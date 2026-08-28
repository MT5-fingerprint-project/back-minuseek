export class FindSealQuery {
  constructor(
    public readonly tenantSlug: string,
    public readonly sha256: string,
  ) {}
}
