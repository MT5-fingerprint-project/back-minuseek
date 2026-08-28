import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SOURCE_ROOT = join(__dirname, '..', '..', '..');

export const READS_INCLUDING_WITHDRAWN: Record<string, string> = {
  'reporting/infrastructure/persistence/prisma-case-report-data.reader.ts':
    'le rapport liste aussi les pièces retirées, avec la date et le motif de leur retrait',
  'biometrics/infrastructure/persistence/prisma-trace.repository.ts':
    'lecture des commandes : le rétablissement doit retrouver une pièce retirée',
  'biometrics/infrastructure/persistence/prisma-reference-print.repository.ts':
    'même motif',
  'biometrics/infrastructure/persistence/prisma-familiar-reference-print.reader.ts':
    "l'obligation de destruction porte aussi sur les empreintes de familiers retirées du dossier",
  'access/infrastructure/persistence/prisma-case-access.reader.ts':
    "le garde d'accès rattache une pièce à son affaire, y compris pour la rétablir",
};

const WITHDRAWABLE_MODELS = ['trace', 'referencePrint', 'hit'];
const READ_OPERATIONS = [
  'findMany',
  'findUnique',
  'findFirst',
  'findUniqueOrThrow',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
];

const READS = new RegExp(
  `prisma\\.(${WITHDRAWABLE_MODELS.join('|')})\\.(${READ_OPERATIONS.join('|')})\\b`,
);

const REAL_DELETES = new RegExp(
  `prisma\\.(trace|referencePrint)\\.(delete|deleteMany)\\b`,
);

function collectSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSources(path);
    }
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

const sources = collectSources(SOURCE_ROOT).map((path) => ({
  key: relative(SOURCE_ROOT, path).split(sep).join('/'),
  content: readFileSync(path, 'utf8'),
}));

const readers = sources.filter((source) => READS.test(source.content));
const filtering = (content: string) => content.includes('NOT_WITHDRAWN');

describe('les lectures des pièces retirées', () => {
  it('trouve bien des fichiers à contrôler', () => {
    expect(readers.length).toBeGreaterThan(3);
  });

  it.each(
    readers
      .filter((source) => !(source.key in READS_INCLUDING_WITHDRAWN))
      .map((source) => source.key),
  )('%s filtre les pièces retirées', (key) => {
    const source = readers.find((candidate) => candidate.key === key);
    expect(filtering(source?.content ?? '')).toBe(true);
  });

  it.each(Object.keys(READS_INCLUDING_WITHDRAWN))(
    "l'exception de %s est encore justifiée",
    (key) => {
      const source = readers.find((candidate) => candidate.key === key);
      expect(source).toBeDefined();
      expect(filtering(source?.content ?? '')).toBe(false);
    },
  );

  it("ne laisse subsister aucune suppression réelle d'une pièce", () => {
    expect(
      sources
        .filter((source) => REAL_DELETES.test(source.content))
        .map((source) => source.key),
    ).toEqual([]);
  });
});
