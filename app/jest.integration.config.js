/**
 * Suite d'intégration : joue contre un vrai Postgres, lancée par
 * `make test-integration`. Volontairement hors du `jest` par défaut, dont le
 * rootDir est `src` — `pnpm test` et la CI unitaire ne la ramassent pas.
 *
 * `maxWorkers: 1` : une seule base, et le test de concurrence veut que la seule
 * concurrence observée soit celle qu'il produit lui-même.
 */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testMatch: ['<rootDir>/test/integration/**/*.int-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 30_000,
};
