import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ChainVerificationReport } from '../../../audit-trail/application/queries/verify-chain/chain-verification-report';
import { VerifyChainQuery } from '../../../audit-trail/application/queries/verify-chain/verify-chain.query';
import type {
  ChainAttestation,
  ChainAttestationPort,
} from '../../application/ports/chain-attestation.port';

/**
 * Seul point du bounded context reporting qui connaît l'audit-trail, et il passe
 * par le bus : l'attestation est le résultat du vérificateur, pas une
 * re-implémentation locale de la vérification.
 */
@Injectable()
export class QueryBusChainAttestationAdapter implements ChainAttestationPort {
  constructor(private readonly queryBus: QueryBus) {}

  async attest(): Promise<ChainAttestation> {
    const report = await this.queryBus.execute<
      VerifyChainQuery,
      ChainVerificationReport
    >(new VerifyChainQuery());

    return {
      ok: report.ok,
      eventsChecked: report.eventsChecked,
      firstBrokenSeq: report.firstBrokenSeq ?? null,
      anchorsVerified: report.anchors.verified,
      anchorsFailed: report.anchors.failed,
    };
  }
}
