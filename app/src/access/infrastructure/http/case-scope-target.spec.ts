import type { CaseScopeTarget } from '../../application/case-access.reader';
import {
  resolveCaseScope,
  routeSegments,
  type CaseScopeSources,
} from './case-scope-target';

const AFFAIRE = '11111111-1111-4111-8111-111111111111';
const AFFAIRE_DE_L_APPELANT = '22222222-2222-4222-8222-222222222222';
const TRACE = '33333333-3333-4333-8333-333333333333';
const IMAGE = '44444444-4444-4444-8444-444444444444';
const CALQUE = '55555555-5555-4555-8555-555555555555';
const RESSOURCE = '66666666-6666-4666-8666-666666666666';
const EMPREINTE = '77777777-7777-4777-8777-777777777777';
const RAPPORT = '88888888-8888-4888-8888-888888888888';

function outcomeOf(
  sources: CaseScopeSources,
): CaseScopeTarget | 'MALFORMED_REQUEST' | 'ROUTE_UNWIRABLE' {
  const resolution = resolveCaseScope(sources);
  return resolution.outcome === 'RESOLVED'
    ? resolution.target
    : resolution.outcome;
}

describe('routeSegments — le chemin de la classe et celui du handler', () => {
  it('assemble le préfixe de contrôleur et le chemin du handler', () => {
    expect(routeSegments(['layers', ':fingerprintId'])).toEqual([
      'layers',
      ':fingerprintId',
    ]);
  });

  it('ignore les chemins vides des contrôleurs sans préfixe', () => {
    expect(routeSegments(['/', 'traces/:id/hits'])).toEqual([
      'traces',
      ':id',
      'hits',
    ]);
  });

  it('tolère un chemin absent', () => {
    expect(routeSegments([undefined, 'me'])).toEqual(['me']);
  });
});

describe('resolveCaseScope — le chemin, quand il porte un identifiant', () => {
  it('lit le caseId des paramètres de chemin', () => {
    expect(
      outcomeOf({
        segments: ['investigation-cases', ':caseId', 'reports'],
        method: 'GET',
        params: { caseId: AFFAIRE },
      }),
    ).toEqual({ kind: 'CASE', id: AFFAIRE });
  });

  it.each<[string[], CaseScopeTarget['kind']]>([
    [['investigation-cases', ':id'], 'CASE'],
    [['traces', ':id'], 'TRACE'],
    [['reference-prints', ':id'], 'REFERENCE_PRINT'],
    [['layers', ':id'], 'LAYER'],
    [['subjects', ':id'], 'SUBJECT'],
    [['reports', ':id'], 'REPORT'],
  ])('résout %s en %s', (segments, kind) => {
    expect(
      outcomeOf({ segments, method: 'GET', params: { id: RESSOURCE } }),
    ).toEqual({ kind, id: RESSOURCE });
  });

  it('résout traces/:id/hits par la trace et non par hits', () => {
    expect(
      outcomeOf({
        segments: ['traces', ':id', 'hits'],
        method: 'GET',
        params: { id: TRACE },
      }),
    ).toEqual({ kind: 'TRACE', id: TRACE });
  });

  it('résout reports/:id/download par le rapport et non par download', () => {
    expect(
      outcomeOf({
        segments: ['reports', ':id', 'download'],
        method: 'GET',
        params: { id: RAPPORT },
      }),
    ).toEqual({ kind: 'REPORT', id: RAPPORT });
  });

  it('résout traces/:id/hit/:referencePrintId par la trace', () => {
    expect(
      outcomeOf({
        segments: ['traces', ':id', 'hit', ':referencePrintId'],
        method: 'DELETE',
        params: { id: TRACE, referencePrintId: EMPREINTE },
      }),
    ).toEqual({ kind: 'TRACE', id: TRACE });
  });

  it('traite layers/:fingerprintId comme une image, pas comme un calque', () => {
    expect(
      outcomeOf({
        segments: ['layers', ':fingerprintId'],
        method: 'GET',
        params: { fingerprintId: IMAGE },
      }),
    ).toEqual({ kind: 'IMAGE', id: IMAGE });
  });
});

describe("resolveCaseScope — le chemin l'emporte sur ce que l'appelant écrit", () => {
  it("ignore un caseId de requête quand le chemin désigne l'affaire", () => {
    expect(
      outcomeOf({
        segments: ['investigation-cases', ':id'],
        method: 'GET',
        params: { id: AFFAIRE },
        query: { caseId: AFFAIRE_DE_L_APPELANT },
      }),
    ).toEqual({ kind: 'CASE', id: AFFAIRE });
  });

  it('ignore un caseId de requête quand le chemin désigne une trace', () => {
    expect(
      outcomeOf({
        segments: ['traces', ':id', 'hits'],
        method: 'GET',
        params: { id: TRACE },
        query: { caseId: AFFAIRE_DE_L_APPELANT },
      }),
    ).toEqual({ kind: 'TRACE', id: TRACE });
  });

  it('ignore un caseId de corps quand le chemin désigne une trace', () => {
    expect(
      outcomeOf({
        segments: ['traces', ':id', 'compare'],
        method: 'POST',
        params: { id: TRACE },
        body: { caseId: AFFAIRE_DE_L_APPELANT, referencePrintIds: [] },
      }),
    ).toEqual({ kind: 'TRACE', id: TRACE });
  });

  it('ignore un caseId de corps quand le chemin désigne un calque', () => {
    expect(
      outcomeOf({
        segments: ['layers', ':id'],
        method: 'PUT',
        params: { id: CALQUE },
        body: { caseId: AFFAIRE_DE_L_APPELANT },
      }),
    ).toEqual({ kind: 'LAYER', id: CALQUE });
  });
});

describe('resolveCaseScope — sans identifiant dans le chemin, la source suit la méthode', () => {
  it('lit le caseId de la requête sur une lecture', () => {
    expect(
      outcomeOf({
        segments: ['traces'],
        method: 'GET',
        query: { caseId: AFFAIRE },
      }),
    ).toEqual({ kind: 'CASE', id: AFFAIRE });
  });

  it('lit le caseId du corps sur une écriture', () => {
    expect(
      outcomeOf({
        segments: ['subjects'],
        method: 'POST',
        body: { caseId: AFFAIRE, firstName: 'Jean' },
      }),
    ).toEqual({ kind: 'CASE', id: AFFAIRE });
  });

  it("ignore le caseId de requête d'une écriture, que le handler ne lira pas", () => {
    expect(
      outcomeOf({
        segments: ['subjects'],
        method: 'POST',
        query: { caseId: AFFAIRE_DE_L_APPELANT },
        body: { caseId: AFFAIRE },
      }),
    ).toEqual({ kind: 'CASE', id: AFFAIRE });
  });

  it("ignore le caseId de corps d'une lecture, que le handler ne lira pas", () => {
    expect(
      outcomeOf({
        segments: ['subjects'],
        method: 'GET',
        query: { caseId: AFFAIRE },
        body: { caseId: AFFAIRE_DE_L_APPELANT },
      }),
    ).toEqual({ kind: 'CASE', id: AFFAIRE });
  });

  it("cherche le fingerprintId, et non un caseId, sur la création d'un calque", () => {
    expect(
      outcomeOf({
        segments: ['layers'],
        method: 'POST',
        query: { caseId: AFFAIRE_DE_L_APPELANT },
        body: {
          fingerprintId: IMAGE,
          caseId: AFFAIRE_DE_L_APPELANT,
          name: 'Minuties',
        },
      }),
    ).toEqual({ kind: 'IMAGE', id: IMAGE });
  });
});

describe('resolveCaseScope — la requête malformée et le câblage fautif se distinguent', () => {
  it("tient pour malformée une lecture sans le caseId qu'elle attend", () => {
    expect(outcomeOf({ segments: ['traces'], method: 'GET', query: {} })).toBe(
      'MALFORMED_REQUEST',
    );
  });

  it('tient pour malformé un caseId répété, que la requête rend en tableau', () => {
    expect(
      outcomeOf({
        segments: ['traces'],
        method: 'GET',
        query: { caseId: [AFFAIRE, AFFAIRE_DE_L_APPELANT] },
      }),
    ).toBe('MALFORMED_REQUEST');
  });

  it('tient pour malformé un identifiant vide', () => {
    expect(
      outcomeOf({ segments: ['traces'], method: 'GET', query: { caseId: '' } }),
    ).toBe('MALFORMED_REQUEST');
  });

  it('tient pour malformée une création de calque sans fingerprintId', () => {
    expect(
      outcomeOf({ segments: ['layers'], method: 'POST', body: { name: 'x' } }),
    ).toBe('MALFORMED_REQUEST');
  });

  it("tient pour malformé un identifiant de chemin qui n'est pas un UUID", () => {
    expect(
      outcomeOf({
        segments: ['traces', ':id', 'hits'],
        method: 'GET',
        params: { id: 'pas-un-uuid' },
      }),
    ).toBe('MALFORMED_REQUEST');
  });

  it("tient pour malformé un caseId de charge utile qui n'est pas un UUID", () => {
    expect(
      outcomeOf({
        segments: ['subjects'],
        method: 'POST',
        body: { caseId: 'pas-un-uuid' },
      }),
    ).toBe('MALFORMED_REQUEST');
  });

  it('tient pour fautive une route marquée dont aucun segment ne désigne de ressource', () => {
    expect(outcomeOf({ segments: ['me'], method: 'GET' })).toBe(
      'ROUTE_UNWIRABLE',
    );
  });

  it('tient pour fautif un paramètre de chemin que la requête ne porte pas', () => {
    expect(
      outcomeOf({ segments: ['traces', ':id'], method: 'GET', params: {} }),
    ).toBe('ROUTE_UNWIRABLE');
  });
});
