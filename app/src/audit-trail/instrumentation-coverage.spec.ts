import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { UNAUDITED_HANDLERS } from '../shared/domain/audit/unaudited-handlers';

const SOURCE_ROOT = join(__dirname, '..');
// Le marqueur est le nom du token tel qu'il est écrit dans le source, pas sa
// valeur ('AuditTrail') : chercher la valeur détecte le type AuditTrailPort,
// donc un handler qui importe le port sans jamais appeler append.
const AUDIT_TRAIL_TOKEN = 'AUDIT_TRAIL';

function collectCommandHandlers(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectCommandHandlers(path);
    }
    const isCommandHandler =
      entry.name.endsWith('.handler.ts') &&
      path.includes(join('application', 'commands'));
    return isCommandHandler ? [path] : [];
  });
}

function asKey(path: string): string {
  return relative(SOURCE_ROOT, path).split(sep).join('/');
}

function isInstrumented(path: string): boolean {
  return readFileSync(path, 'utf8').includes(AUDIT_TRAIL_TOKEN);
}

const handlers = collectCommandHandlers(SOURCE_ROOT).map((path) => ({
  key: asKey(path),
  instrumented: isInstrumented(path),
}));

describe("couverture d'instrumentation des command handlers", () => {
  it('trouve bien les handlers à couvrir (garde-fou du garde-fou)', () => {
    expect(handlers.length).toBeGreaterThan(0);
  });

  it.each(handlers)(
    'le handler $key appelle AUDIT_TRAIL ou porte une exemption motivée',
    ({ key, instrumented }) => {
      const motive = UNAUDITED_HANDLERS[key];
      if (!instrumented) {
        expect(motive ?? '').not.toBe('');
      }
    },
  );

  it('ne garde aucune exemption périmée : handler disparu ou déjà instrumenté', () => {
    const stillUnaudited = new Set(
      handlers.filter((handler) => !handler.instrumented).map((h) => h.key),
    );

    expect(
      Object.keys(UNAUDITED_HANDLERS).filter((key) => !stillUnaudited.has(key)),
    ).toEqual([]);
  });
});
