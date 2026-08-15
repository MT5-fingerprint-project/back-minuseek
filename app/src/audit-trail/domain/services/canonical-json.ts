/**
 * Json Canonicalization Scheme (JCS-lite) implementation.
 * we serialize the payload of an audit event to compute its hash, and we need this serialization to be canonical.
 * For more information seee https://www.rfc-editor.org/info/rfc8785/ and See ADR-0009, point 4.
 
 * Rules for canonicalization:
 *  - object keys sorted recursively (lexicographic order of UTF-16 code units, default JS sort)
 * - no whitespace; strings escaped by `JSON.stringify` (minimal escaping, as specified by ECMA-262)
 * - numbers: simple decimal notation only — NaN, ±Infinity and any value whose representation is exponential (`1e+21`, `1e-7`…) are REJECTED; `-0` canonicalizes to `0`
 * - `bigint` accepted (exact integer, serialized in base 10)
 * - `undefined` properties ignored (equivalent to absent); `undefined` IN an array rejected
 * - `Date`, functions, symbols and class instances rejected: dates must be converted to ISO-8601 UTC BEFORE serialization (see audit-event-hash), payloads remain pure data.
 * 
 */

export class CanonicalizationError extends Error {
  constructor(reason: string) {
    super(`Sérialisation canonique impossible : ${reason}`);
  }
}

function canonicalNumber(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new CanonicalizationError(
      'NaN et Infinity ne sont pas représentables en JSON',
    );
  }
  const plain = String(value);
  if (plain.includes('e') || plain.includes('E')) {
    throw new CanonicalizationError(
      `le nombre ${plain} exigerait une notation exponentielle — utiliser une chaîne ou un bigint`,
    );
  }
  return plain;
}

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return canonicalNumber(value);
    case 'bigint':
      return value.toString(10);
    case 'undefined':
      throw new CanonicalizationError(
        "undefined n'est pas représentable en JSON",
      );
    case 'function':
    case 'symbol':
      throw new CanonicalizationError(
        `le type "${typeof value}" n'est pas représentable en JSON`,
      );
    default:
      break;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => {
      if (item === undefined) {
        throw new CanonicalizationError(
          'un tableau ne peut pas contenir undefined',
        );
      }
      return canonicalJson(item);
    });
    return `[${items.join(',')}]`;
  }

  if (value instanceof Date) {
    throw new CanonicalizationError(
      'les dates doivent être converties en ISO-8601 UTC avant sérialisation',
    );
  }

  if (!isPlainObject(value)) {
    throw new CanonicalizationError(
      'seuls les objets « plats » (sans prototype de classe) sont sérialisables',
    );
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
  return `{${entries.join(',')}}`;
}
