export const SERVICE_USER_DIRECTORY = 'ServiceUserDirectory';

/** Ce qu'une affaire a besoin de savoir d'un compte utilisateur: qu'il existe,
 * et qu'il peut encore se voir confier un dossier. Rien d'autre — le contexte
 * identity-access reste seul à les écrire. */
export interface DesignatableServiceUser {
  id: string;
  disabled: boolean;
}

export interface ServiceUserDirectory {
  findById(userId: string): Promise<DesignatableServiceUser | null>;
}
