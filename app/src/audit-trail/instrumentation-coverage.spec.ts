import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { UNAUDITED_TABLES } from '../shared/domain/audit/unaudited-tables';

const SOURCE_ROOT = join(__dirname, '..');

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

const knownHandlers = new Set(
  collectCommandHandlers(SOURCE_ROOT).map((path) =>
    relative(SOURCE_ROOT, path).split(sep).join('/'),
  ),
);

describe('exemptions de tables du garde fail-closed', () => {
  it.each(Object.entries(UNAUDITED_TABLES))(
    "l'exemption de la table %s cite des handlers qui existent",
    (_table, handlerKeys) => {
      expect(handlerKeys.filter((key) => !knownHandlers.has(key))).toEqual([]);
    },
  );
});
