export class RegisterSubjectCommand {
  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly birthDate: Date,
    public readonly birthPlace: string,
    public readonly sex: string,
    public readonly caseId: string,
    public readonly type: string,
    public readonly firstParentName?: string | null,
    public readonly secondParentName?: string | null,
    public readonly phoneNumber?: string | null,
    public readonly color?: string | null,
  ) {}
}
