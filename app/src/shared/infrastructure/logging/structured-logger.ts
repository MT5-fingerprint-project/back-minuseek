import { Injectable } from '@nestjs/common';

export type LogSeverity = 'INFO' | 'WARNING' | 'ERROR';

/**
 * Une ligne JSON par événement sur stdout : c'est le format que Cloud Logging
 * indexe en champs, là où le Logger de Nest produit du texte préfixé dont on ne
 * peut pas déduire d'alerte.
 */
@Injectable()
export class StructuredLogger {
  log(
    severity: LogSeverity,
    message: string,
    fields: Record<string, unknown> = {},
  ): void {
    process.stdout.write(
      `${JSON.stringify({ severity, message, ...fields })}\n`,
    );
  }
}
