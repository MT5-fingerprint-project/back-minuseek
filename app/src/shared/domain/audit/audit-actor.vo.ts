export enum AuditActorTypeEnum {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export interface AuditActorPrimitives {
  type: AuditActorTypeEnum;
  sub: string;
  username: string;
  displayName: string;
}

interface UserActorProps {
  sub: string;
  username: string;
  displayName: string;
}

export class InvalidAuditActorError extends Error {
  constructor(field: string) {
    super(`L'acteur d'un événement d'audit exige un "${field}" non vide`);
  }
}

const SYSTEM_SUB_PREFIX = 'system:';

function isAuditActorType(value: string): value is AuditActorTypeEnum {
  return (Object.values(AuditActorTypeEnum) as string[]).includes(value);
}

function requireNonBlank(
  value: string | undefined | null,
  field: string,
): string {
  const normalized = (value ?? '').trim();
  if (normalized.length === 0) {
    throw new InvalidAuditActorError(field);
  }
  return normalized;
}

// Keep an actor snapshot so that the audit trail is not affect by user renaming or other changes.
export class AuditActor {
  private constructor(
    private readonly type: AuditActorTypeEnum,
    private readonly sub: string,
    private readonly username: string,
    private readonly displayName: string,
  ) {}

  static user(props: UserActorProps): AuditActor {
    return new AuditActor(
      AuditActorTypeEnum.USER,
      requireNonBlank(props.sub, 'sub'),
      requireNonBlank(props.username, 'username'),
      requireNonBlank(props.displayName, 'displayName'),
    );
  }

  // for system actor like cron job or system event
  static system(name: string): AuditActor {
    const systemName = requireNonBlank(name, 'name');
    return new AuditActor(
      AuditActorTypeEnum.SYSTEM,
      `${SYSTEM_SUB_PREFIX}${systemName}`,
      systemName,
      systemName,
    );
  }

  static reconstitute(primitives: AuditActorPrimitives): AuditActor {
    if (!isAuditActorType(primitives.type)) {
      throw new InvalidAuditActorError('type');
    }
    return new AuditActor(
      primitives.type,
      requireNonBlank(primitives.sub, 'sub'),
      requireNonBlank(primitives.username, 'username'),
      requireNonBlank(primitives.displayName, 'displayName'),
    );
  }

  isSystem(): boolean {
    return this.type === AuditActorTypeEnum.SYSTEM;
  }

  toPrimitives(): AuditActorPrimitives {
    return {
      type: this.type,
      sub: this.sub,
      username: this.username,
      displayName: this.displayName,
    };
  }

  equals(other: AuditActor): boolean {
    return (
      this.type === other.type &&
      this.sub === other.sub &&
      this.username === other.username &&
      this.displayName === other.displayName
    );
  }
}
