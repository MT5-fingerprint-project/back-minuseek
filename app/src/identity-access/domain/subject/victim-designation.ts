/**
 * La forme sous laquelle le nom d'une victime entre au journal : prénom,
 * initiale du nom, point. Seule exception d'abrègement du produit — la table des
 * actes refuse `UPDATE` et `DELETE`, ce qui y entre n'en ressort plus.
 *
 * Pas d'analyse ni de repli : les champs arrivent déjà séparés du formulaire.
 */
export function victimShortLabel(victim: {
  firstName: string;
  lastName: string;
}): string {
  const firstName = victim.firstName.trim();
  const lastName = victim.lastName.trim();
  if (lastName === '') return firstName;
  return `${firstName} ${lastName.charAt(0).toLocaleUpperCase('fr')}.`;
}
