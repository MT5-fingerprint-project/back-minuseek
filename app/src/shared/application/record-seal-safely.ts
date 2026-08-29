import {
  SealRegistryPort,
  SealToRecord,
} from '../domain/ports/seal-registry.port';

export async function recordSealSafely(
  registry: SealRegistryPort,
  seal: SealToRecord,
  logger: { warn(message: string): void },
): Promise<void> {
  try {
    await registry.record(seal);
  } catch (error) {
    logger.warn(
      `Scellé non projeté au registre public: ${seal.sha256} (${String(error)}) — « make seals-sync » répare`,
    );
  }
}
