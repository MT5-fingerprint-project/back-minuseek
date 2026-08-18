import * as asn1js from 'asn1js';
import {
  AlgorithmIdentifier,
  ContentInfo,
  MessageImprint,
  SignedData,
  TSTInfo,
  TimeStampReq,
  TimeStampResp,
} from 'pkijs';
import { TimestampAuthorityError } from './timestamp-authority.error';

const SHA256_OID = '2.16.840.1.101.3.4.2.1';
const PKI_STATUS_GRANTED = 0;
const PKI_STATUS_GRANTED_WITH_MODS = 1;

export function buildTimestampRequest(digest: Buffer, nonce: Buffer): Buffer {
  const request = new TimeStampReq({
    version: 1,
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({ algorithmId: SHA256_OID }),
      hashedMessage: new asn1js.OctetString({ valueHex: digest }),
    }),
    nonce: new asn1js.Integer({ valueHex: nonce }),
    certReq: true,
  });
  return Buffer.from(request.toSchema().toBER(false));
}

export interface TimestampTokenContent {
  signedData: SignedData;
  tstInfo: TSTInfo;
}

/** TSTInfo et SignedData d'un TSR, une fois le token dépaqueté. */
export function readTimestampToken(tsrDer: Buffer): TimestampTokenContent {
  const parsed = asn1js.fromBER(new Uint8Array(tsrDer));
  if (parsed.offset === -1) {
    throw new TimestampAuthorityError('réponse illisible (ASN.1 invalide)');
  }

  const response = new TimeStampResp({ schema: parsed.result });
  const status: number = response.status.status;
  if (
    status !== PKI_STATUS_GRANTED &&
    status !== PKI_STATUS_GRANTED_WITH_MODS
  ) {
    throw new TimestampAuthorityError(`horodatage refusé (status ${status})`);
  }
  if (!response.timeStampToken) {
    throw new TimestampAuthorityError('réponse sans timeStampToken');
  }

  const token = new ContentInfo({ schema: response.timeStampToken.toSchema() });
  const signedData = new SignedData({ schema: token.content });
  const eContent = signedData.encapContentInfo.eContent;
  if (!eContent) {
    throw new TimestampAuthorityError('token sans TSTInfo');
  }

  const tstInfoBer = asn1js.fromBER(eContent.getValue());
  if (tstInfoBer.offset === -1) {
    throw new TimestampAuthorityError('TSTInfo illisible');
  }
  return { signedData, tstInfo: new TSTInfo({ schema: tstInfoBer.result }) };
}

export function readTstInfo(tsrDer: Buffer): TSTInfo {
  return readTimestampToken(tsrDer).tstInfo;
}

/**
 * Vérifie que le TSR signe bien `timestampedData` : signature du TSTInfo par le
 * certificat embarqué, et messageImprint == sha256(timestampedData). La chaîne
 * X.509 n'est pas remontée jusqu'à une racine de confiance (best-effort v1,
 * ADR-0009) — ce contrôle prouve le lien TSR/donnée, pas la qualification de la
 * TSA.
 */
export async function verifyTimestampOverData(
  tsrDer: Buffer,
  timestampedData: Buffer,
): Promise<boolean> {
  try {
    const { signedData } = readTimestampToken(tsrDer);
    const data = new Uint8Array(timestampedData).buffer;
    return await signedData.verify({ signer: 0, data });
  } catch {
    return false;
  }
}

export function verifyTimestampMatches(
  tstInfo: TSTInfo,
  digest: Buffer,
  nonce?: Buffer,
): void {
  const hashedMessage = Buffer.from(
    tstInfo.messageImprint.hashedMessage.getValue(),
  );
  if (!hashedMessage.equals(digest)) {
    throw new TimestampAuthorityError(
      "le messageImprint horodaté n'est pas celui envoyé",
    );
  }
  if (nonce) {
    const echoed = tstInfo.nonce
      ? Buffer.from(tstInfo.nonce.valueBlock.valueHexView)
      : null;
    if (!echoed || !echoed.equals(nonce)) {
      throw new TimestampAuthorityError('nonce non réfléchi par la TSA');
    }
  }
}
