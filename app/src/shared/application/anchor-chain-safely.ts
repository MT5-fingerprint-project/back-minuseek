import { ChainAnchoringPort } from '../domain/ports/chain-anchoring.port';

export async function anchorChainSafely(
  anchoring: ChainAnchoringPort,
  logger: { warn(message: string): void },
): Promise<void> {
  try {
    await anchoring.anchor();
  } catch (error) {
    logger.warn(
      `Horodatage extérieur non obtenu (${String(error)}) — « make audit-anchor » répare`,
    );
  }
}
