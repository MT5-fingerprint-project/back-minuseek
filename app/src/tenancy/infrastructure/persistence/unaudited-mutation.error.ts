export class UnauditedMutationError extends Error {
  constructor(tables: string[]) {
    super(
      `Mutation non chaînée sur ${tables.join(', ')} : la transaction écrit en base sans appeler AUDIT_TRAIL. ` +
        `Instrumente le handler, ou déclare la table dans UNAUDITED_TABLES avec son motif.`,
    );
  }
}
