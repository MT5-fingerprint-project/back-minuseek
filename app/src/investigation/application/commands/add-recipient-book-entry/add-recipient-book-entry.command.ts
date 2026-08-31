export class AddRecipientBookEntryCommand {
  constructor(
    public readonly authority: string,
    public readonly attentionQuality?: string | null,
    public readonly attentionName?: string | null,
  ) {}
}
