export const NOT_WITHDRAWN = { withdrawnAt: null } as const;

export const WITHDRAWN_ONLY = { withdrawnAt: { not: null } } as const;
