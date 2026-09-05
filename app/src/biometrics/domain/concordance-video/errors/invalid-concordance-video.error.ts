export class InvalidConcordanceVideoError extends Error {
  constructor(reason: string) {
    super(`Vidéo de concordances invalide : ${reason}`);
  }
}
