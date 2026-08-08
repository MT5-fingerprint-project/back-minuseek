import { CanonicalizationError, canonicalJson } from './canonical-json';

describe('canonicalJson', () => {
  describe('primitives', () => {
    it('sérialise null', () => {
      expect(canonicalJson(null)).toBe('null');
    });

    it('sérialise les booléens', () => {
      expect(canonicalJson(true)).toBe('true');
      expect(canonicalJson(false)).toBe('false');
    });

    it("sérialise les chaînes avec l'échappement JSON minimal", () => {
      expect(canonicalJson('empreinte')).toBe('"empreinte"');
      expect(canonicalJson('a"b\\c')).toBe('"a\\"b\\\\c"');
      expect(canonicalJson('ligne1\nligne2\ttab')).toBe(
        '"ligne1\\nligne2\\ttab"',
      );
    });

    it("préserve les accents et l'unicode sans échappement superflu", () => {
      expect(canonicalJson('pièce scellée n°3 — départ')).toBe(
        '"pièce scellée n°3 — départ"',
      );
      expect(canonicalJson('指紋')).toBe('"指紋"');
    });

    it('sérialise les nombres en notation décimale simple', () => {
      expect(canonicalJson(0)).toBe('0');
      expect(canonicalJson(42)).toBe('42');
      expect(canonicalJson(-17)).toBe('-17');
      expect(canonicalJson(123.456)).toBe('123.456');
    });

    it('canonicalise -0 en 0', () => {
      expect(canonicalJson(-0)).toBe('0');
    });

    it('sérialise les bigint en base 10', () => {
      expect(canonicalJson(1n)).toBe('1');
      expect(canonicalJson(9007199254740993n)).toBe('9007199254740993');
    });
  });

  describe('objets et tableaux', () => {
    it("trie les clés d'objet", () => {
      expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    });

    it("produit la même sortie quel que soit l'ordre d'insertion des clés", () => {
      const insertionOrder1 = { zone: 'PALM', hand: 'LEFT', score: 87 };
      const insertionOrder2 = { score: 87, hand: 'LEFT', zone: 'PALM' };
      expect(canonicalJson(insertionOrder1)).toBe(
        canonicalJson(insertionOrder2),
      );
    });

    it('trie récursivement dans les objets imbriqués et les tableaux', () => {
      const nested = {
        settings: [{ opacity: 0.5, blend: 'multiply' }],
        name: 'calque',
      };
      expect(canonicalJson(nested)).toBe(
        '{"name":"calque","settings":[{"blend":"multiply","opacity":0.5}]}',
      );
    });

    it('sérialise sans aucun espace', () => {
      expect(canonicalJson({ a: [1, 2], b: { c: true } })).not.toMatch(/\s/);
    });

    it('ignore les propriétés undefined (équivalentes à absentes)', () => {
      expect(canonicalJson({ a: 1, b: undefined })).toBe(
        canonicalJson({ a: 1 }),
      );
    });

    it('sérialise un objet vide et un tableau vide', () => {
      expect(canonicalJson({})).toBe('{}');
      expect(canonicalJson([])).toBe('[]');
    });

    it("préserve l'ordre des tableaux (seules les clés sont triées)", () => {
      expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    });
  });

  describe('valeurs rejetées (fail-fast avant chaînage)', () => {
    it('rejette NaN et Infinity', () => {
      expect(() => canonicalJson(NaN)).toThrow(CanonicalizationError);
      expect(() => canonicalJson(Infinity)).toThrow(CanonicalizationError);
      expect(() => canonicalJson(-Infinity)).toThrow(CanonicalizationError);
    });

    it('rejette les nombres à notation exponentielle', () => {
      expect(() => canonicalJson(1e21)).toThrow(CanonicalizationError);
      expect(() => canonicalJson(1e-7)).toThrow(CanonicalizationError);
    });

    it('rejette undefined seul ou dans un tableau', () => {
      expect(() => canonicalJson(undefined)).toThrow(CanonicalizationError);
      expect(() => canonicalJson([1, undefined, 3])).toThrow(
        CanonicalizationError,
      );
    });

    it('rejette les Date (conversion ISO-8601 exigée en amont)', () => {
      expect(() => canonicalJson(new Date())).toThrow(CanonicalizationError);
      expect(() => canonicalJson({ at: new Date() })).toThrow(
        CanonicalizationError,
      );
    });

    it('rejette les fonctions, symboles et instances de classe', () => {
      expect(() => canonicalJson(() => 'nope')).toThrow(CanonicalizationError);
      expect(() => canonicalJson(Symbol('nope'))).toThrow(
        CanonicalizationError,
      );
      class NotPlain {
        value = 1;
      }
      expect(() => canonicalJson(new NotPlain())).toThrow(
        CanonicalizationError,
      );
      expect(() => canonicalJson(new Map())).toThrow(CanonicalizationError);
    });

    it('accepte un objet sans prototype (Object.create(null))', () => {
      const bare = Object.create(null) as Record<string, unknown>;
      bare.a = 1;
      expect(canonicalJson(bare)).toBe('{"a":1}');
    });
  });
});
