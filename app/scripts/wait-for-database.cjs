/**
 * Attend que le port Postgres accepte une connexion, avant toute commande Prisma.
 *
 * Le job Cloud Run sort en VPC direct : la programmation de son interface
 * réseau se termine parfois après le démarrage du conteneur, et la première
 * poignée de main TCP prend alors quelques secondes — au-delà du
 * `connect_timeout` de 5 s que Prisma applique sans possibilité de le régler
 * autrement que dans l'URL. Le job échouait en P1001 sur un chemin réseau
 * pourtant sain (2,05 s de poignée de main mesurés le 27/08). Hôte et port
 * viennent d'ADMIN_DATABASE_URL : les bases tenant sont sur la même instance.
 */
const net = require('node:net');

const MAX_ATTEMPTS = 10;
const ATTEMPT_TIMEOUT_MS = 10_000;
const DELAY_BETWEEN_ATTEMPTS_MS = 3_000;

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    socket.setTimeout(ATTEMPT_TIMEOUT_MS);
    const settle = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.on('connect', () => settle(true));
    socket.on('timeout', () => settle(false));
    socket.on('error', () => settle(false));
  });
}

const wait = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

async function main() {
  const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
  if (!adminDatabaseUrl) {
    throw new Error('ADMIN_DATABASE_URL is not set');
  }
  const { hostname, port } = new URL(adminDatabaseUrl);
  const databasePort = Number(port || 5432);
  const target = `${hostname}:${databasePort}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    if (await isPortOpen(hostname, databasePort)) {
      const elapsedMs = Date.now() - startedAt;
      process.stdout.write(
        `  ${target} reachable in ${elapsedMs}ms (attempt ${attempt})\n`
      );
      return;
    }
    process.stdout.write(
      `  ${target} unreachable (attempt ${attempt}/${MAX_ATTEMPTS})\n`
    );
    if (attempt < MAX_ATTEMPTS) {
      await wait(DELAY_BETWEEN_ATTEMPTS_MS);
    }
  }

  throw new Error(
    `${target} still unreachable after ${MAX_ATTEMPTS} attempts`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
