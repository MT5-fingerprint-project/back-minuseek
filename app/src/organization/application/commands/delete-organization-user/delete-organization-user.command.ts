export class DeleteOrganizationUserCommand {
  constructor(
    public readonly organizationSlug: string,
    public readonly userId: string,
  ) {}
}
