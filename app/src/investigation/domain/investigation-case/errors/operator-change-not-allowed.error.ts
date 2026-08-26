export class OperatorChangeNotAllowedError extends Error {
  constructor(caseId: string) {
    super(
      `Seul l'opérateur en place ou un responsable de service peut confier l'affaire "${caseId}"`,
    );
  }
}
