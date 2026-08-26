export const SERVICE_USER_DIRECTORY = 'ServiceUserDirectory';

/** Les comptes du service, vus depuis l'affaire : on ne demande que leur existence,
 * le contexte identity-access reste seul à les écrire. */
export interface ServiceUserDirectory {
  exists(userId: string): Promise<boolean>;
}
