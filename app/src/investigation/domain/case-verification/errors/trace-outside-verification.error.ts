export class TraceOutsideVerificationError extends Error {
  constructor(traceId: string, verificationId: string) {
    super(
      `La trace "${traceId}" n'appartient pas au dossier vérifié par la mission "${verificationId}"`,
    );
  }
}
