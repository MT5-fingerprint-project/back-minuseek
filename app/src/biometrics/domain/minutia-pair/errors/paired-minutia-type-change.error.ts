export class PairedMinutiaTypeChangeError extends Error {
  constructor(layerId: string) {
    super(
      `Le type de la minutie ${layerId} ne peut plus changer tant qu'elle est appariée : défaites la paire d'abord`,
    );
  }
}
