export class LayerNotFoundError extends Error {
  constructor(id: string) {
    super(`Layer ${id} not found`);
  }
}
