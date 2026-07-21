export class RegisterUserCommand {
  constructor(
    public readonly identityProviderId: string,
    public readonly role: string,
    public readonly grade: string,
    public readonly serviceNumber: string,
    public readonly firstName: string,
    public readonly lastName: string,
  ) {}
}
