/**
 * Le filtre de retrait, écrit une seule fois et posé explicitement sur chaque
 * lecture. Pas d'extension globale du client Prisma : le rapport doit voir les
 * pièces retirées, et une extension ne filtre pas les lectures imbriquées —
 * `prisma-reference-print.reader.ts` en contient une.
 * `withdrawal-coverage.spec.ts` échoue sur toute lecture qui l'oublie.
 */
export const NOT_WITHDRAWN = { withdrawnAt: null } as const;

export const WITHDRAWN_ONLY = { withdrawnAt: { not: null } } as const;
