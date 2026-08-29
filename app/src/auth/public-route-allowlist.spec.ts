import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_ROOT = join(__dirname, '..');

const ALLOWED = ['audit-trail/infrastructure/http/public-seal.controller.ts'];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('dérogation à l’authentification globale', () => {
  it('n’est posée que sur le contrôleur public', () => {
    const carriers = sourceFiles(SOURCE_ROOT)
      .filter((path) =>
        /^\s*@PublicRoute\(\)/m.test(readFileSync(path, 'utf8')),
      )
      .map((path) => relative(SOURCE_ROOT, path).split('\\').join('/'))
      .sort();

    expect(carriers).toEqual(ALLOWED);
  });
});
