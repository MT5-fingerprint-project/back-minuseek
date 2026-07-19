import { BadGatewayException } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import {
  CompareFingerprintsInput,
  FingerprintMatchCandidate,
  FingerprintMatcherPort,
} from '../../application/ports/fingerprint-matcher.port';

interface DataCompareResult {
  reference_print: string;
  score: number;
}

interface DataCompareResponse {
  results: DataCompareResult[];
}

// Adapter sortant vers le service data interne (jamais exposé au front) :
// le back valide l'appartenance caseId/traceId/referencePrintIds avant d'appeler
// ce endpoint, data lui fait confiance en retour (cf. ADR-0004).
export class DataFingerprintMatcherAdapter implements FingerprintMatcherPort {
  private readonly auth = new GoogleAuth();

  constructor(private readonly baseUrl: string) {}

  // Le service data est privé (ingress interne + --no-allow-unauthenticated) :
  // l'appel doit porter un ID token Google dont l'audience est l'URL du service
  // (run.invoker accordé au SA back côté IAM). Sur Cloud Run, le token est émis
  // par le serveur de métadonnées.
  private async authorizationHeader(): Promise<string> {
    const client = await this.auth.getIdTokenClient(this.baseUrl);
    const token = await client.idTokenProvider.fetchIdToken(this.baseUrl);
    return `Bearer ${token}`;
  }

  async compare(
    input: CompareFingerprintsInput,
  ): Promise<FingerprintMatchCandidate[]> {
    const authorization = await this.authorizationHeader();
    const response = await fetch(`${this.baseUrl}/data/api/compare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({
        case_id: input.caseId,
        trace_id: input.traceId,
        reference_print_ids: input.referencePrintIds,
        top: input.referencePrintIds.length,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        'Le service de comparaison est indisponible',
      );
    }

    let data: DataCompareResponse;
    try {
      data = (await response.json()) as DataCompareResponse;
    } catch {
      throw new BadGatewayException(
        'Réponse invalide du service de comparaison',
      );
    }

    if (!Array.isArray(data?.results)) {
      throw new BadGatewayException(
        'Réponse invalide du service de comparaison',
      );
    }

    return data.results.map((result) => ({
      referencePrintId: result.reference_print,
      score: result.score,
    }));
  }
}
