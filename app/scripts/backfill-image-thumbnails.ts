import { Storage } from '@google-cloud/storage';
import { Pool } from 'pg';
import { InvalidImageError } from '../src/biometrics/application/ports/image-converter.port';
import { thumbnailPath } from '../src/biometrics/application/services/displayable-image';
import { SharpImageConverterAdapter } from '../src/biometrics/infrastructure/conversion/sharp-image-converter.adapter';

// `DATABASE_URL` vise la base d'un tenant, jamais `minuseek_dev` où aucune
// image ne vit : « make backfill-thumbnails » la construit.
// Aucun acte n'est journalisé — une vignette est un artefact d'affichage, pas
// une pièce (ADR-0022).

// Une empreinte détruite est écartée : son objet n'existe plus, et en
// refabriquer une contredirait l'acte qui affirme la destruction.
const TABLES = [
  { table: 'Trace', where: '' },
  { table: 'ReferencePrint', where: 'AND "imageDestroyedAt" IS NULL' },
  { table: 'TraceLocationPhoto', where: '' },
] as const;

interface ImageRow {
  id: string;
  path: string;
}

interface Tally {
  built: number;
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
    `SELECT id, path FROM "${table}" WHERE "thumbPath" IS NULL ${extraWhere} ORDER BY id`,
  );
  process.stdout.write(`${table}: ${rows.length} image(s) sans vignette\n`);

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
    let thumbnail: Buffer;
    try {
      thumbnail = await converter.toDisplayThumbnail(bytes);
    } catch (error) {
      if (!(error instanceof InvalidImageError)) {
        throw error;
      }
      tally.unreadable += 1;
      process.stdout.write(`  ${table} ${row.id}: image illisible\n`);
      continue;
    }

    const key = thumbnailPath(row.path);
    await bucket.file(key).save(thumbnail, {
      contentType: 'image/webp',
      resumable: false,
    });
    await pool.query(`UPDATE "${table}" SET "thumbPath" = $1 WHERE id = $2`, [
      key,
      row.id,
    ]);
    tally.built += 1;
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
  const tally: Tally = { built: 0, missing: 0, unreadable: 0 };
  try {
    for (const { table, where } of TABLES) {
      await backfillTable(pool, bucket, table, where, tally);
    }
  } finally {
    await pool.end();
  }

  process.stdout.write(
    `Vignettes fabriquées : ${tally.built} — objets absents : ${tally.missing} — images illisibles : ${tally.unreadable}\n`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
