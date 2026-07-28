export type MinutiaeSide = 'trace' | 'reference-print';

export class InsufficientMinutiaeError extends Error {
  constructor(
    public readonly side: MinutiaeSide,
    public readonly count: number,
    public readonly required: number,
  ) {
    const label = side === 'trace' ? 'la trace' : "l'empreinte de référence";
    super(
      `Minuties insuffisantes sur ${label} : ${count}/${required} requises pour déclarer un hit`,
    );
  }
}
