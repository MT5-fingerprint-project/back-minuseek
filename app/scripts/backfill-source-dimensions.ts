import { Storage } from '@google-cloud/storage';
import { Pool } from 'pg';
import { InvalidImageError } from '../src/biometrics/application/ports/image-converter.port';
import { SharpImageConverterAdapter } from '../src/biometrics/infrastructure/conversion/sharp-image-converter.adapter';

// `DATABASE_URL` vise la base d'un tenant, jamais `minuseek_dev` où aucune
// image ne vit : « make backfill-source-dimensions » la construit.
// Aucun acte n'est journalisé — les dimensions sont une propriété mesurable du
// fichier déjà scellé, relue telle quelle, et non une modification de la pièce.

// Une empreinte détruite est écartée : son objet n'existe plus, et il n'y a
// plus rien à mesurer.
const TABLES = [
  { table: 'Trace', where: '' },
  { table: 'ReferencePrint', where: 'AND "imageDestroyedAt" IS NULL' },
] as const;

interface ImageRow {
  id: string;
  path: string;
}

interface Tally {
  measured: number;
  missing: number;
  unreadable: number;
}

const converter = new SharpImageConverterAdapter();

async function backfillTable(
  pool: Pool,
  bucket: ReturnType<Storage['bucket']>,
  table: string,
  extraWhere: string,
  tally: Tally,
): Promise<void> {
  const { rows } = await pool.query<ImageRow>(
    `SELECT id, path FROM "${table}"
     WHERE ("sourceWidth" IS NULL OR "sourceHeight" IS NULL) ${extraWhere}
     ORDER BY id`,
  );
  process.stdout.write(`${table}: ${rows.length} image(s) sans dimensions\n`);

  for (const row of rows) {
    const original = bucket.file(row.path);
    if (!(await original.exists())[0]) {
      tally.missing += 1;
      process.stdout.write(
        `  ${table} ${row.id}: objet absent (${row.path})\n`,
      );
      continue;
    }

    const [bytes] = await original.download();
    let size: { width: number; height: number };
    try {
      size = await converter.displayedSize(bytes);
    } catch (error) {
      if (!(error instanceof InvalidImageError)) {
        throw error;
      }
      tally.unreadable += 1;
      process.stdout.write(`  ${table} ${row.id}: image illisible\n`);
      continue;
    }

    await pool.query(
      `UPDATE "${table}" SET "sourceWidth" = $1, "sourceHeight" = $2 WHERE id = $3`,
      [size.width, size.height, row.id],
    );
    tally.measured += 1;
    process.stdout.write(
      `  ${table} ${row.id}: ${size.width}x${size.height}\n`,
    );
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error('GCS_BUCKET is not set');
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const bucket = new Storage().bucket(bucketName);
  const tally: Tally = { measured: 0, missing: 0, unreadable: 0 };
  try {
    for (const { table, where } of TABLES) {
      await backfillTable(pool, bucket, table, where, tally);
    }
  } finally {
    await pool.end();
  }

  process.stdout.write(
    `Dimensions relevées : ${tally.measured} — objets absents : ${tally.missing} — images illisibles : ${tally.unreadable}\n`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
