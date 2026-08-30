export class LayerAlreadyExistsError extends Error {
  constructor(id: string) {
    super(
      `Un calque porte déjà l'identifiant "${id}" : une création n'écrase pas un calque existant`,
    );
  }
}
