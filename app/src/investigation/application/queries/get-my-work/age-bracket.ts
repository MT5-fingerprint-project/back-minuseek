// Seuils en jours. Trois mois vaut 90 jours et six mois 182 : des durées rondes
// que l'opérateur reconnaît, pas des mois calendaires, qui feraient dépendre la
// tranche d'un dossier du mois où on la regarde.
const THREE_MONTHS_IN_DAYS = 90;
const SIX_MONTHS_IN_DAYS = 182;

export interface AgeBracketCounts {
  overSixMonths: number;
  threeToSixMonths: number;
  underThreeMonths: number;
}

export function countByAgeBracket(agesInDays: number[]): AgeBracketCounts {
  const counted: AgeBracketCounts = {
    overSixMonths: 0,
    threeToSixMonths: 0,
    underThreeMonths: 0,
  };

  for (const ageInDays of agesInDays) {
    if (ageInDays > SIX_MONTHS_IN_DAYS) {
      counted.overSixMonths += 1;
    } else if (ageInDays > THREE_MONTHS_IN_DAYS) {
      counted.threeToSixMonths += 1;
    } else {
      counted.underThreeMonths += 1;
    }
  }

  return counted;
}
