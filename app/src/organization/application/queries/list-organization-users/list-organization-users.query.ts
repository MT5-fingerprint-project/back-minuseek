export class ListOrganizationUsersQuery {
  constructor(
    public readonly organizationSlug: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
