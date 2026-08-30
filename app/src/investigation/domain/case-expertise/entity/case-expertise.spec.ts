import { CaseExpertise } from './case-expertise';
import { InvalidCaseExpertiseError } from '../errors/invalid-case-expertise.error';
import { InvalidSaisineError } from '../errors/invalid-saisine.error';

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

describe('CaseExpertise — saisine', () => {
  const ORDONNANCE = new Date('2026-03-04T00:00:00.000Z');
  const PROROGATION = new Date('2026-06-30T00:00:00.000Z');

  it('part sans aucun élément de saisine', () => {
    expect(declare().toPrimitives()).toMatchObject({
      magistrateName: null,
      ordinanceDate: null,
      missionObject: null,
      sealCount: null,
      prorogationDeadline: null,
      prorogationOrdinanceDate: null,
      biologicalPrecautions: false,
      assistants: [],
    });
  });

  it('enregistre les éléments de la commission', () => {
    const expertise = declare();

    expertise.completeSaisine({
      magistrateName: 'Claire Rousseau',
      magistrateTitle: "Juge d'instruction",
      ordinanceDate: ORDONNANCE,
      missionObject: 'Exploitation des traces papillaires',
      sealCount: 3,
    });

    expect(expertise.toPrimitives()).toMatchObject({
      magistrateName: 'Claire Rousseau',
      magistrateTitle: "Juge d'instruction",
      ordinanceDate: ORDONNANCE,
      missionObject: 'Exploitation des traces papillaires',
      sealCount: 3,
    });
  });

  it('ne rend que les champs réellement modifiés', () => {
    const expertise = declare();
    expertise.completeSaisine({ sealCount: 3, missionObject: 'Traces' });

    const changes = expertise.completeSaisine({
      sealCount: 3,
      missionObject: 'Traces papillaires',
    });

    expect(changes).toEqual({ missionObject: 'Traces papillaires' });
  });

  it('ne rend aucun changement quand rien ne bouge', () => {
    const expertise = declare();
    expertise.completeSaisine({ biologicalPrecautions: true });

    expect(expertise.completeSaisine({ biologicalPrecautions: true })).toEqual(
      {},
    );
  });

  it('remplace la liste des assistants', () => {
    const expertise = declare();
    expertise.completeSaisine({
      assistants: [{ name: 'Paul Ferrand', task: 'Ouverture du véhicule' }],
    });

    const changes = expertise.completeSaisine({
      assistants: [{ name: 'Léa Nguyen', task: 'Insertion au FAED' }],
    });

    expect(changes).toEqual({
      assistants: [{ name: 'Léa Nguyen', task: 'Insertion au FAED' }],
    });
    expect(expertise.toPrimitives().assistants).toEqual([
      { name: 'Léa Nguyen', task: 'Insertion au FAED' },
    ]);
  });

  it('refuse un nombre de scellés nul ou négatif', () => {
    expect(() => declare().completeSaisine({ sealCount: 0 })).toThrow(
      InvalidSaisineError,
    );
    expect(() => declare().completeSaisine({ sealCount: -1 })).toThrow(
      InvalidSaisineError,
    );
  });

  it("refuse une prorogation antérieure à l'ordonnance initiale", () => {
    const expertise = declare();
    expertise.completeSaisine({ ordinanceDate: ORDONNANCE });

    expect(() =>
      expertise.completeSaisine({
        prorogationOrdinanceDate: new Date('2026-01-01T00:00:00.000Z'),
        prorogationDeadline: PROROGATION,
      }),
    ).toThrow(InvalidSaisineError);
  });

  it("refuse une prorogation datée du jour de l'ordonnance initiale", () => {
    const expertise = declare();
    expertise.completeSaisine({ ordinanceDate: ORDONNANCE });

    expect(() =>
      expertise.completeSaisine({ prorogationOrdinanceDate: ORDONNANCE }),
    ).toThrow(InvalidSaisineError);
  });

  it("accepte une prorogation postérieure à l'ordonnance initiale", () => {
    const expertise = declare();
    expertise.completeSaisine({ ordinanceDate: ORDONNANCE });

    expertise.completeSaisine({
      prorogationOrdinanceDate: new Date('2026-05-02T00:00:00.000Z'),
      prorogationDeadline: PROROGATION,
    });

    expect(expertise.toPrimitives().prorogationDeadline).toEqual(PROROGATION);
  });

  it("laisse passer une prorogation quand l'ordonnance initiale n'est pas saisie", () => {
    const expertise = declare();

    expect(() =>
      expertise.completeSaisine({
        prorogationOrdinanceDate: new Date('2026-05-02T00:00:00.000Z'),
      }),
    ).not.toThrow();
  });

  it("n'écrit rien quand une règle refuse la saisine", () => {
    const expertise = declare();
    expertise.completeSaisine({ sealCount: 3 });

    expect(() =>
      expertise.completeSaisine({ missionObject: 'Traces', sealCount: -2 }),
    ).toThrow(InvalidSaisineError);
    expect(expertise.toPrimitives()).toMatchObject({
      sealCount: 3,
      missionObject: null,
    });
  });

  it('se relit à l’identique après reconstitution', () => {
    const expertise = declare();
    expertise.completeSaisine({
      ordinanceDate: ORDONNANCE,
      sealCount: 2,
      assistants: [{ name: 'Paul Ferrand', task: 'Ouverture du véhicule' }],
    });

    const primitives = expertise.toPrimitives();

    expect(CaseExpertise.reconstitute(primitives).toPrimitives()).toEqual(
      primitives,
    );
  });
});
