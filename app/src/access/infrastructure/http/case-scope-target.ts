import type { CaseScopeTarget } from '../../application/case-access.reader';

type ResourceKind = CaseScopeTarget['kind'];

interface ResourceSegment {
  fromPath: ResourceKind;
  payloadKey: string;
  payloadKind: ResourceKind;
}

const RESOURCE_SEGMENTS = new Map<string, ResourceSegment>([
  [
    'investigation-cases',
    { fromPath: 'CASE', payloadKey: 'caseId', payloadKind: 'CASE' },
  ],
  ['traces', { fromPath: 'TRACE', payloadKey: 'caseId', payloadKind: 'CASE' }],
  [
    'reference-prints',
    { fromPath: 'REFERENCE_PRINT', payloadKey: 'caseId', payloadKind: 'CASE' },
  ],
  [
    'layers',
    { fromPath: 'LAYER', payloadKey: 'fingerprintId', payloadKind: 'IMAGE' },
  ],
  [
    'subjects',
    { fromPath: 'SUBJECT', payloadKey: 'caseId', payloadKind: 'CASE' },
  ],
  [
    'reports',
    { fromPath: 'REPORT', payloadKey: 'caseId', payloadKind: 'CASE' },
  ],
]);

const METHODS_CARRYING_A_BODY = new Set(['POST', 'PUT', 'PATCH']);

// Toutes les clés que le garde résout sont des colonnes `@db.Uuid` : une valeur
// d'une autre forme fait lever le driver Prisma au lieu de rendre `null`.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CaseScopeSources {
  segments: string[];
  method?: string;
  params?: unknown;
  query?: unknown;
  body?: unknown;
}

export type CaseScopeResolution =
  | { outcome: 'RESOLVED'; target: CaseScopeTarget }
  | { outcome: 'MALFORMED_REQUEST' }
  | { outcome: 'ROUTE_UNWIRABLE' };

export function routeSegments(paths: (string | undefined)[]): string[] {
  return paths
    .flatMap((path) => (path ?? '').split('/'))
    .filter((segment) => segment.length > 0);
}

// Un garde s'exécute avant le ValidationPipe : la requête et le corps qu'il lit
// sont encore bruts, donc forgeables. Il ne cherche l'identifiant que là où le
// handler ira le chercher lui-même — le chemin d'abord, sinon le corps pour une
// écriture et la requête pour une lecture — sinon il autoriserait sur une
// affaire dont le handler ne fera rien.
export function resolveCaseScope(
  sources: CaseScopeSources,
): CaseScopeResolution {
  const resourceIndex = sources.segments.findIndex((segment) =>
    RESOURCE_SEGMENTS.has(segment),
  );
  const resource = RESOURCE_SEGMENTS.get(sources.segments[resourceIndex] ?? '');
  if (resource === undefined) {
    return { outcome: 'ROUTE_UNWIRABLE' };
  }

  const nextSegment = sources.segments[resourceIndex + 1];
  if (nextSegment?.startsWith(':')) {
    const parameterName = nextSegment.slice(1);
    const written = readString(sources.params, parameterName);
    if (written === undefined) {
      return { outcome: 'ROUTE_UNWIRABLE' };
    }
    if (!UUID.test(written)) {
      return { outcome: 'MALFORMED_REQUEST' };
    }
    return resolved(
      parameterName === 'fingerprintId' ? 'IMAGE' : resource.fromPath,
      written,
    );
  }

  const payload = METHODS_CARRYING_A_BODY.has(
    (sources.method ?? '').toUpperCase(),
  )
    ? sources.body
    : sources.query;
  const written = readString(payload, resource.payloadKey);
  return written !== undefined && UUID.test(written)
    ? resolved(resource.payloadKind, written)
    : { outcome: 'MALFORMED_REQUEST' };
}

function resolved(kind: ResourceKind, id: string): CaseScopeResolution {
  return { outcome: 'RESOLVED', target: { kind, id } };
}

function readString(source: unknown, name: string): string | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  const value = (source as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
