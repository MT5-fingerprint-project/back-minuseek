export class GetVerificationQuery {
  constructor(
    public readonly verificationId: string,
    public readonly requesterId: string | null,
  ) {}
}
