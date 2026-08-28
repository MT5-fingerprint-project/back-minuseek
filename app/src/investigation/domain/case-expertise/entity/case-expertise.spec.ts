import { CaseExpertise } from './case-expertise';
import { InvalidCaseExpertiseError } from '../errors/invalid-case-expertise.error';

const SERMENT =
  'Je soussigné Julien Marchand, brigadier-chef en fonction au SRPTS de Paris, ' +
  "expert désigné pour procéder aux opérations prévues dans l'ordonnance de " +
  "commission d'expert, prête serment de bien et fidèlement la remplir en mon " +
  'honneur et conscience.';

const declare = (
  overrides: Partial<Parameters<typeof CaseExpertise.declare>[0]> = {},
) =>
  CaseExpertise.declare({
    id: 'expertise-1',
    caseId: 'affaire-1',
    expertUserId: 'user-1',
    oathStatement: SERMENT,
    courtReference: 'Tribunal judiciaire de Paris',
    ...overrides,
  });

describe('CaseExpertise', () => {
  it('archive le serment tel quel', () => {
    expect(declare().toPrimitives().oathStatement).toBe(SERMENT);
  });

  it('conserve les espaces et la ponctuation du texte reçu', () => {
    const brut = `  ${SERMENT}\n`;

    expect(declare({ oathStatement: brut }).toPrimitives().oathStatement).toBe(
      brut,
    );
  });

  it('date le serment du moment de la déclaration', () => {
    const avant = Date.now();

    const swornAt = declare().toPrimitives().swornAt;

    expect(swornAt.getTime()).toBeGreaterThanOrEqual(avant);
    expect(swornAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('refuse une déclaration sans texte de serment', () => {
    expect(() => declare({ oathStatement: '' })).toThrow(
      InvalidCaseExpertiseError,
    );
  });

  it('refuse un serment qui ne porte que des blancs', () => {
    expect(() => declare({ oathStatement: '   \n  ' })).toThrow(
      InvalidCaseExpertiseError,
    );
  });

  it('refuse une déclaration sans juridiction mandante', () => {
    expect(() => declare({ courtReference: '  ' })).toThrow(
      InvalidCaseExpertiseError,
    );
  });

  it("nomme le champ fautif dans l'erreur", () => {
    expect(() => declare({ courtReference: '' })).toThrow(/"courtReference"/);
  });
});
