export interface ChainVerificationReport {
  ok: boolean;
  eventsChecked: number;
  firstBrokenSeq?: number;
  anchors: { verified: number; failed: number };
  /** Renseigné quand la chaîne s'arrête sous la dernière ancre : troncature. */
  truncatedBelowSeq?: number;
}
