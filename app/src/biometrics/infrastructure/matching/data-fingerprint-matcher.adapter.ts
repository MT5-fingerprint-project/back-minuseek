import { BadGatewayException } from '@nestjs/common';
import {
  CompareFingerprintsInput,
  FingerprintMatchCandidate,
  FingerprintMatcherPort,
} from '../../application/ports/fingerprint-matcher.port';

interface DataCompareResult {
  reference_print: string;
  score: number;
  match: boolean;
}

interface DataCompareResponse {
  results: DataCompareResult[];
}

// Adapter sortant vers le service data interne (jamais exposé au front) :
// le back valide l'appartenance caseId/traceId/referencePrintIds avant d'appeler
// ce endpoint, data lui fait confiance en retour (cf. ADR-0004).
export class DataFingerprintMatcherAdapter implements FingerprintMatcherPort {
  constructor(private readonly baseUrl: string) {}

  async compare(
    input: CompareFingerprintsInput,
  ): Promise<FingerprintMatchCandidate[]> {
    const response = await fetch(`${this.baseUrl}/data/api/compare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        case_id: input.caseId,
        trace_id: input.traceId,
        reference_print_ids: input.referencePrintIds,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        'Le service de comparaison est indisponible',
      );
    }

    const data = (await response.json()) as DataCompareResponse;
    return data.results.map((result) => ({
      referencePrintId: result.reference_print,
      score: result.score,
      match: result.match,
    }));
  }
}
