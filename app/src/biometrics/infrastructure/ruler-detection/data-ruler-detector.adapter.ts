import { BadGatewayException } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import {
  DetectRulerInput,
  RulerDetection,
  RulerDetectorPort,
} from '../../application/ports/ruler-detector.port';

interface DataDetectRulerResponse {
  present: boolean;
  confidence: number;
  engine_version?: string;
}

export class DataRulerDetectorAdapter implements RulerDetectorPort {
  private readonly auth = new GoogleAuth();

  constructor(private readonly baseUrl: string) {}

  // Même authentification que DataFingerprintMatcherAdapter : service data privé,
  // ID token Google dont l'audience est l'URL du service.
  private async authorizationHeader(): Promise<string> {
    const client = await this.auth.getIdTokenClient(this.baseUrl);
    const token = await client.idTokenProvider.fetchIdToken(this.baseUrl);
    return `Bearer ${token}`;
  }

  async detect(input: DetectRulerInput): Promise<RulerDetection> {
    const authorization = await this.authorizationHeader();
    // Octets en clair en multipart : à ce stade la trace n'existe nulle part,
    // un contrat par identifiants est impossible (ADR-0014).
    const body = new FormData();
    body.append(
      'image',
      new Blob([new Uint8Array(input.image)], { type: input.mimeType }),
      'trace',
    );
    const response = await fetch(`${this.baseUrl}/data/api/detect-ruler`, {
      method: 'POST',
      headers: { authorization },
      body,
    });

    if (!response.ok) {
      throw new BadGatewayException(
        'Le service de détection de règle est indisponible',
      );
    }

    let data: DataDetectRulerResponse;
    try {
      data = (await response.json()) as DataDetectRulerResponse;
    } catch {
      throw new BadGatewayException(
        'Réponse invalide du service de détection de règle',
      );
    }

    if (
      typeof data?.present !== 'boolean' ||
      typeof data?.confidence !== 'number'
    ) {
      throw new BadGatewayException(
        'Réponse invalide du service de détection de règle',
      );
    }

    return {
      present: data.present,
      confidence: data.confidence,
      engineVersion: data.engine_version ?? null,
    };
  }
}
