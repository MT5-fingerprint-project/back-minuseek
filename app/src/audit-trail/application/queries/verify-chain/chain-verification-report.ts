export interface ChainVerificationReport {
  ok: boolean;
  eventsChecked: number;
  firstBrokenSeq?: number;
}
