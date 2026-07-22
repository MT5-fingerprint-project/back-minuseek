export enum FingerPositionEnum {
  RIGHT_THUMB = 'RIGHT_THUMB',
  RIGHT_INDEX = 'RIGHT_INDEX',
  RIGHT_MIDDLE = 'RIGHT_MIDDLE',
  RIGHT_RING = 'RIGHT_RING',
  RIGHT_LITTLE = 'RIGHT_LITTLE',
  LEFT_THUMB = 'LEFT_THUMB',
  LEFT_INDEX = 'LEFT_INDEX',
  LEFT_MIDDLE = 'LEFT_MIDDLE',
  LEFT_RING = 'LEFT_RING',
  LEFT_LITTLE = 'LEFT_LITTLE',
  RIGHT_PALM = 'RIGHT_PALM',
  LEFT_PALM = 'LEFT_PALM',
  OTHER = 'OTHER',
}

export class InvalidFingerPositionError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas une position d'empreinte valide`);
  }
}

export class FingerPosition {
  private constructor(private readonly value: FingerPositionEnum) {}

  static from(raw: string): FingerPosition {
    if (
      !Object.values(FingerPositionEnum).includes(raw as FingerPositionEnum)
    ) {
      throw new InvalidFingerPositionError(raw);
    }
    return new FingerPosition(raw as FingerPositionEnum);
  }

  getValue(): FingerPositionEnum {
    return this.value;
  }

  equals(other: FingerPosition): boolean {
    return this.value === other.value;
  }
}
