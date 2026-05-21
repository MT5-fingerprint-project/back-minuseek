export const TraceStatus = {
  RECEIVED: 'RECEIVED',
  EXPLOITABLE: 'EXPLOITABLE',
  NOT_EXPLOITABLE: 'NOT_EXPLOITABLE',
} as const;

export type TraceStatus = (typeof TraceStatus)[keyof typeof TraceStatus];
