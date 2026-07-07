/**
 * Liste les bases métier des tenants enregistrés (une par ligne, sur stdout).
 *
 * Source de vérité = le registre (`tenant.database_name` dans minuseek_admin),
 * PAS un motif de nom sur pg_database : on ne migre ainsi jamais par erreur
 * minuseek_admin ni keycloak, et un tenant devient migrable dès qu'il est
 * enregistré. Consommé par migrate-all.sh.
 */
const { Pool } = require('pg');

async function main() {
  const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
  if (!adminDatabaseUrl) {
    throw new Error('ADMIN_DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const result = await pool.query(
      'SELECT database_name FROM "tenant" ORDER BY database_name'
    );
    for (const row of result.rows) {
      process.stdout.write(`${row.database_name}\n`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
