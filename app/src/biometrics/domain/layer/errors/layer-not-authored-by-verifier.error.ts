export class LayerNotAuthoredByVerifierError extends Error {
  constructor(layerId: string) {
    super(
      `Le calque "${layerId}" n'est pas celui du vérificateur : une vérification ne touche pas au travail de l'opérateur`,
    );
  }
}
