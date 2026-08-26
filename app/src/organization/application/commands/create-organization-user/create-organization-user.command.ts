export class CreateOrganizationUserCommand {
  constructor(
    public readonly organizationSlug: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: string,
    public readonly grade: string,
    public readonly serviceNumber: string,
  ) {}
}
