export class RulerNotDetectedError extends Error {
  constructor(public readonly confidence: number) {
    super(
      "Aucune règle millimétrée détectée sur la photo : sans échelle, la trace n'est pas exploitable",
    );
  }
}
