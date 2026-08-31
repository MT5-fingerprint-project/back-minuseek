import { InvalidRecipientBookEntryError } from '../errors/invalid-recipient-book-entry.error';

interface CreateRecipientBookEntryProps {
  id: string;
  authority: string;
  attentionQuality?: string | null;
  attentionName?: string | null;
}

export interface RecipientBookEntryPrimitives {
  id: string;
  authority: string;
  attentionQuality: string | null;
  attentionName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RecipientBookEntry {
  private constructor(
    private readonly _id: string,
    private readonly _authority: string,
    private readonly _attentionQuality: string | null,
    private readonly _attentionName: string | null,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
  ) {}

  static create(props: CreateRecipientBookEntryProps): RecipientBookEntry {
    const authority = props.authority.trim();
    if (authority === '') throw new InvalidRecipientBookEntryError();

    const now = new Date();
    return new RecipientBookEntry(
      props.id,
      authority,
      RecipientBookEntry.normalizeOptional(props.attentionQuality),
      RecipientBookEntry.normalizeOptional(props.attentionName),
      now,
      now,
    );
  }

  static reconstitute(
    primitives: RecipientBookEntryPrimitives,
  ): RecipientBookEntry {
    return new RecipientBookEntry(
      primitives.id,
      primitives.authority,
      primitives.attentionQuality,
      primitives.attentionName,
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  private static normalizeOptional(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  toPrimitives(): RecipientBookEntryPrimitives {
    return {
      id: this._id,
      authority: this._authority,
      attentionQuality: this._attentionQuality,
      attentionName: this._attentionName,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  get id(): string {
    return this._id;
  }

  get authority(): string {
    return this._authority;
  }

  get attentionQuality(): string | null {
    return this._attentionQuality;
  }

  get attentionName(): string | null {
    return this._attentionName;
  }
}
