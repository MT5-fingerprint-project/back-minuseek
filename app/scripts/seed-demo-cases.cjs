/**
 * Décor d'un service de démonstration : des dossiers datés, leurs pièces, et
 * les missions de vérification qui vont avec. Écrit directement dans la base du
 * tenant, sans passer par les commandes.
 *
 *   node scripts/seed-demo-cases.cjs <slug> [--dry-run] [--trace-path=… --print-path=…]
 *
 * Deux raisons à l'écriture directe, aucune des deux n'est un raccourci :
 *
 *   1. les dates d'ouverture et de clôture s'étalent sur l'année — aucune API
 *      ne permet de les poser, et la page d'activité lit l'année civile ;
 *   2. la base d'un tenant n'a qu'une IP privée : ce script tourne dans le job
 *      Cloud Run de migration, qui porte déjà le registre et le gabarit d'URL.
 *
 * AUCUN ACTE N'EST ÉCRIT AU JOURNAL. Un journal de démonstration qui affirmerait
 * des actes qui n'ont pas eu lieu serait faux dans la seule table du produit qui
 * se présente comme une preuve. Conséquence assumée et pilotée ici : un dossier
 * sans acte retombe sur sa date d'ouverture pour le signal « sans acte depuis
 * trente jours », donc l'encours est daté récent, sauf trois dossiers qui
 * vieillissent exprès.
 *
 * Rejouable : chaque ligne porte un identifiant dérivé de son rang, et toutes
 * les insertions sont en ON CONFLICT DO NOTHING. Aucune suppression : pour
 * repartir de zéro, effacer les dossiers dont le numéro commence par 2025-009 ou
 * 2026-005, deux plages réservées à ce script.
 */
const { Pool } = require('pg');
const { createHash } = require('node:crypto');

const SEED_NAMESPACE = 'b3f1a6c2-5d84-4c1e-9a70-2f0c8e5d7a11';
const SERVICE_SETTINGS_ROW_ID = 'service-settings';
const PLACEHOLDER_PATH = 'seed/missing-image';

/** Le score rendu par le moteur est un score SourceAFIS brut, pas un rapport :
 * le verdict de correspondance est ce seuil, et rien d'autre (MATCH_THRESHOLD
 * dans matching-score.vo.ts). */
const MATCH_THRESHOLD = 40;

const LETTERHEAD = {
  administration:
    "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

/** L'encours. Les âges sont choisis, pas tirés : ce sont eux qui décident de ce
 * qu'affiche l'encart « ce qui demande une décision ». Trois dossiers passent
 * les trente jours, un seul passe les quatre-vingt-dix, un seul est sans
 * titulaire. */
const OPEN_CASES = [
  { ageDays: 3, status: 'OPEN', operator: 0 },
  { ageDays: 9, status: 'IN_PROGRESS', operator: 1 },
  { ageDays: 14, status: 'IN_PROGRESS', operator: 2 },
  { ageDays: 21, status: 'UNDER_REVIEW', operator: 3 },
  { ageDays: 27, status: 'OPEN', operator: null },
  { ageDays: 45, status: 'IN_PROGRESS', operator: 4 },
  { ageDays: 68, status: 'UNDER_REVIEW', operator: 5 },
  { ageDays: 124, status: 'IN_PROGRESS', operator: 0 },
];

/** Les délais de clôture, en jours, répétés en boucle sur les trente-cinq
 * dossiers clos : médiane autour de trente-cinq jours, neuvième décile autour de
 * quatre-vingts. */
const CLOSURE_DURATIONS = [
  12, 28, 45, 19, 63, 34, 22, 88, 40, 15, 52, 30, 25, 71, 36,
];

const CLOSED_COUNT = 35;

/** Trois titulaires passent les dix clôtures qu'exige la médiane par opérateur,
 * trois autres restent en dessous : la colonne montre les deux cas. */
const CLOSURE_OWNERS = [
  ...Array(11).fill(0),
  ...Array(10).fill(1),
  ...Array(10).fill(2),
  3,
  4,
  5,
  3,
];

const OFFENSES = [
  'Vol par effraction',
  'Cambriolage de locaux d’habitation',
  'Vol de véhicule',
  'Dégradations volontaires',
  'Vol à la roulotte',
  'Tentative de vol avec effraction',
  'Recel de biens volés',
  'Vol dans un local commercial',
];

const PLACES = [
  'Paris 11e — rue de la Roquette',
  'Paris 18e — rue Marcadet',
  'Paris 20e — boulevard de Charonne',
  'Paris 13e — avenue d’Italie',
  'Paris 15e — rue de Vaugirard',
  'Paris 19e — rue de Belleville',
  'Paris 12e — rue de Charenton',
  'Paris 17e — avenue de Clichy',
];

const REQUESTERS = [
  { name: 'Sylvain Gautier', service: 'Commissariat du 11e arrondissement' },
  { name: 'Marion Delaunay', service: 'Commissariat du 18e arrondissement' },
  { name: 'Olivier Pasquier', service: 'Brigade de répression du banditisme' },
  { name: 'Nathalie Broch', service: 'Commissariat du 20e arrondissement' },
  { name: 'Frédéric Aubin', service: 'Sûreté territoriale de Paris' },
];

const TRACE_PLACES = [
  'Poignée intérieure de la porte-fenêtre',
  'Vitre de la fenêtre sur rue',
  'Montant de la porte d’entrée',
  'Flanc du coffre-fort',
  'Bouteille en verre abandonnée sur la table',
  'Tiroir de la caisse',
  'Rétroviseur côté conducteur',
  'Plaque de cuisson',
];

const SUBJECT_NAMES = [
  { firstName: 'Yanis', lastName: 'Bouchard', sex: 'MALE' },
  { firstName: 'Dimitri', lastName: 'Sorel', sex: 'MALE' },
  { firstName: 'Sabrina', lastName: 'Nowak', sex: 'FEMALE' },
  { firstName: 'Renato', lastName: 'Carvalho', sex: 'MALE' },
  { firstName: 'Leïla', lastName: 'Amrani', sex: 'FEMALE' },
  { firstName: 'Kévin', lastName: 'Perrot', sex: 'MALE' },
];

const TRACE_COUNTS = [2, 1, 3, 0, 2, 1, 2, 3, 1, 0];

function uuidFrom(name) {
  const hash = createHash('sha1');
  hash.update(Buffer.from(SEED_NAMESPACE.replace(/-/g, ''), 'hex'));
  hash.update(name, 'utf8');
  const bytes = hash.digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function parseOptions(argv) {
  const options = { slug: null, dryRun: false, tracePath: null, printPath: null };
  for (const argument of argv) {
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument.startsWith('--')) {
      const [flag, value] = argument.split('=');
      const key = { '--slug': 'slug', '--trace-path': 'tracePath', '--print-path': 'printPath' }[flag];
      if (!key || !value) throw new Error(`Argument non reconnu : ${argument}`);
      options[key] = value;
      continue;
    }
    options.slug = argument;
  }
  if (!options.slug) {
    throw new Error('Slug manquant : node scripts/seed-demo-cases.cjs <slug>');
  }
  return options;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function atMidday(date) {
  const copy = new Date(date);
  copy.setUTCHours(9, 30, 0, 0);
  return copy;
}

function daysBefore(reference, days) {
  return atMidday(new Date(reference.getTime() - days * 86_400_000));
}

function caseNumberOf(openedAt, counters) {
  const year = openedAt.getUTCFullYear();
  const range = year === 2025 ? 900 : 500;
  counters[year] = (counters[year] ?? 0) + 1;
  return `${year}-${String(range + counters[year]).padStart(5, '0')}`;
}

function pick(list, index) {
  return list[index % list.length];
}

/** Le plan est calculé avant toute écriture : c'est lui qu'on imprime en
 * --dry-run, et c'est lui que les insertions suivent ligne à ligne. */
function planCases(now, operators) {
  const counters = {};
  const cases = [];

  const rows = [
    ...OPEN_CASES.map((entry, index) => ({
      key: `open-${index}`,
      openedAt: daysBefore(now, entry.ageDays),
      closedAt: null,
      status: entry.status,
      operatorIndex: entry.operator,
    })),
    ...Array.from({ length: CLOSED_COUNT }, (_, index) => {
      const closedAt = daysBefore(now, 250 - index * 7);
      const duration = pick(CLOSURE_DURATIONS, index);
      return {
        key: `closed-${index}`,
        openedAt: daysBefore(closedAt, duration),
        closedAt,
        status: 'CLOSED',
        operatorIndex: CLOSURE_OWNERS[index],
      };
    }),
  ].sort((left, right) => left.openedAt - right.openedAt);

  for (const [index, row] of rows.entries()) {
    const requester = pick(REQUESTERS, index);
    const offenseAt = daysBefore(row.openedAt, 2);
    cases.push({
      ...row,
      id: uuidFrom(`case:${row.key}`),
      caseNumber: caseNumberOf(row.openedAt, counters),
      pvNumber: `PV-${row.openedAt.getUTCFullYear()}-${String(1000 + index * 7).padStart(5, '0')}`,
      operatorUserId:
        row.operatorIndex === null ? null : operators[row.operatorIndex % operators.length].id,
      offenseNature: pick(OFFENSES, index),
      offenseLocation: pick(PLACES, index),
      offenseDateFrom: offenseAt,
      interventionDate: daysBefore(row.openedAt, 1),
      requestDate: row.openedAt,
      requesterName: requester.name,
      requesterService: requester.service,
      traceCount: pick(TRACE_COUNTS, index),
      subject: pick(SUBJECT_NAMES, index),
    });
  }

  return cases;
}

/** L'entonnoir : une trace sur cinq n'est pas exploitable, deux exploitables sur
 * trois ont été comparées, une comparaison sur trois a donné un rapprochement. */
function planPieces(cases, images) {
  const traces = [];
  const prints = [];
  const subjects = [];
  const matchings = [];
  const hits = [];

  let traceIndex = 0;
  for (const investigation of cases) {
    if (investigation.traceCount === 0) continue;

    const subjectId = uuidFrom(`subject:${investigation.key}`);
    subjects.push({
      id: subjectId,
      caseId: investigation.id,
      ...investigation.subject,
      createdAt: investigation.openedAt,
    });

    const printId = uuidFrom(`print:${investigation.key}`);
    prints.push({
      id: printId,
      caseId: investigation.id,
      subjectId,
      createdAt: atMidday(new Date(investigation.openedAt.getTime() + 86_400_000)),
      ...images.print,
    });

    for (let number = 1; number <= investigation.traceCount; number += 1) {
      const status = traceIndex % 5 === 3 ? 'RECEIVED' : traceIndex % 5 === 4 ? 'NOT_EXPLOITABLE' : 'EXPLOITABLE';
      const traceId = uuidFrom(`trace:${investigation.key}:${number}`);
      traces.push({
        id: traceId,
        caseId: investigation.id,
        number,
        status,
        location: pick(TRACE_PLACES, traceIndex),
        createdAt: atMidday(new Date(investigation.openedAt.getTime() + 86_400_000)),
        ...images.trace,
      });

      const compared = status === 'EXPLOITABLE' && traceIndex % 3 !== 2;
      if (compared) {
        const identified = traceIndex % 6 === 0;
        const score = identified
          ? MATCH_THRESHOLD + 8 + ((traceIndex * 13) % 70)
          : 6 + ((traceIndex * 7) % 28);
        matchings.push({
          id: uuidFrom(`matching:${investigation.key}:${number}`),
          traceId,
          referencePrintId: printId,
          score,
          match: score >= MATCH_THRESHOLD,
          createdAt: atMidday(new Date(investigation.openedAt.getTime() + 3 * 86_400_000)),
        });
        if (identified) {
          hits.push({
            id: uuidFrom(`hit:${investigation.key}:${number}`),
            traceId,
            referencePrintId: printId,
            declaredByUserId: investigation.operatorUserId,
            createdAt: atMidday(new Date(investigation.openedAt.getTime() + 4 * 86_400_000)),
          });
        }
      }
      traceIndex += 1;
    }
  }

  return { traces, prints, subjects, matchings, hits };
}

/** Le domaine refuse deux choses qu'on reproduit ici : un titulaire ne se
 * vérifie pas lui-même, et un responsable du service n'est pas vérificateur. */
function pickVerifier(operators, ownerUserId, offset) {
  for (let step = 0; step < operators.length; step += 1) {
    const position =
      (operators.length * 2 - 1 - offset - step) % operators.length;
    const candidate = operators[position];
    if (candidate.id !== ownerUserId) return candidate;
  }
  return null;
}

function planVerifications(cases, operators, managers, now) {
  if (managers.length === 0) return [];

  const candidates = cases.filter(
    (investigation) =>
      investigation.status === 'UNDER_REVIEW' ||
      investigation.status === 'IN_PROGRESS',
  );
  const verifications = [];

  for (const [index, investigation] of candidates.entries()) {
    if (verifications.length === 3) break;
    const verifier = pickVerifier(operators, investigation.operatorUserId, index);
    if (!verifier) continue;
    verifications.push({
      id: uuidFrom(`verification:${investigation.key}`),
      caseId: investigation.id,
      verifierUserId: verifier.id,
      requestedByUserId: managers[index % managers.length].id,
      requestedAt: daysBefore(now, 2 + index * 3),
    });
  }

  return verifications;
}

async function resolveTenantDatabase(slug) {
  const pool = new Pool({ connectionString: requireEnv('ADMIN_DATABASE_URL'), max: 1 });
  try {
    const result = await pool.query(
      'SELECT database_name, display_name FROM "tenant" WHERE slug = $1',
      [slug],
    );
    if (result.rowCount === 0) {
      throw new Error(`Aucun tenant « ${slug} » dans le registre`);
    }
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

async function readDirectory(client) {
  const result = await client.query(
    `SELECT u.id, u.role, p."firstName", p."lastName"
       FROM "User" u
       JOIN "PersonalData" p ON p.id = u."personalDataId"
      WHERE u.status = 'ACTIVE'
      ORDER BY u."serviceNumber"`,
  );
  return result.rows;
}

/** Les pièces du décor réutilisent une image déjà déposée dans le tenant : elle
 * est déjà dans le bon bucket, déjà vignettée, déjà mesurée. Sans elle, les
 * dossiers se montent sans pièce plutôt qu'avec une vignette cassée. */
async function borrowImages(client, options) {
  const donor = async (table) => {
    const result = await client.query(
      `SELECT path, "thumbPath", "sourceWidth", "sourceHeight"
         FROM "${table}"
        WHERE "withdrawnAt" IS NULL AND path <> $1
        ORDER BY "createdAt" DESC
        LIMIT 1`,
      [PLACEHOLDER_PATH],
    );
    return result.rows[0] ?? null;
  };

  const trace = options.tracePath
    ? { path: options.tracePath, thumbPath: null, sourceWidth: null, sourceHeight: null }
    : await donor('Trace');
  const print = options.printPath
    ? { path: options.printPath, thumbPath: null, sourceWidth: null, sourceHeight: null }
    : await donor('ReferencePrint');

  return trace && print ? { trace, print } : null;
}

async function insertCases(client, cases) {
  for (const investigation of cases) {
    await client.query(
      `INSERT INTO "InvestigationCase" (
         id, "caseNumber", "pvNumber", description, status, "operatorUserId",
         "lastTraceNumber", "closedAt", "requestDate", "requesterQuality",
         "requesterName", "requesterService", "offenseNature", "offenseLocation",
         "offenseDateFrom", "interventionDate", "recipientAuthority",
         "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5::"InvestigationCaseStatus",$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
       ON CONFLICT DO NOTHING`,
      [
        investigation.id,
        investigation.caseNumber,
        investigation.pvNumber,
        null,
        investigation.status,
        investigation.operatorUserId,
        investigation.traceCount,
        investigation.closedAt,
        investigation.requestDate,
        'Officier de police judiciaire',
        investigation.requesterName,
        investigation.requesterService,
        investigation.offenseNature,
        investigation.offenseLocation,
        investigation.offenseDateFrom,
        investigation.interventionDate,
        'Tribunal judiciaire de Paris',
        investigation.openedAt,
      ],
    );
  }
}

async function insertPieces(client, pieces) {
  for (const subject of pieces.subjects) {
    await client.query(
      `INSERT INTO "Subject" (id, "firstName", "lastName", sex, type, "caseId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4::"Sex",'PERSON_OF_INTEREST',$5,$6,$6)
       ON CONFLICT DO NOTHING`,
      [subject.id, subject.firstName, subject.lastName, subject.sex, subject.caseId, subject.createdAt],
    );
  }

  for (const print of pieces.prints) {
    await client.query(
      `INSERT INTO "ReferencePrint" (id, path, "caseId", "thumbPath", "subjectId", "sourceWidth", "sourceHeight", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       ON CONFLICT DO NOTHING`,
      [print.id, print.path, print.caseId, print.thumbPath, print.subjectId, print.sourceWidth, print.sourceHeight, print.createdAt],
    );
  }

  for (const trace of pieces.traces) {
    await client.query(
      `INSERT INTO "Trace" (id, number, path, status, "caseId", "thumbPath", "sourceWidth", "sourceHeight", origin, location, "revelationTechnique", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4::"TraceStatus",$5,$6,$7,$8,'DIGITAL',$9,'FINGERPRINT_POWDER',$10,$10)
       ON CONFLICT DO NOTHING`,
      [trace.id, trace.number, trace.path, trace.status, trace.caseId, trace.thumbPath, trace.sourceWidth, trace.sourceHeight, trace.location, trace.createdAt],
    );
  }

  for (const matching of pieces.matchings) {
    await client.query(
      `INSERT INTO "Matching" (id, "traceId", "referencePrintId", score, match, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT DO NOTHING`,
      [matching.id, matching.traceId, matching.referencePrintId, matching.score, matching.match, matching.createdAt],
    );
  }

  for (const hit of pieces.hits) {
    await client.query(
      `INSERT INTO "Hit" (id, "traceId", "referencePrintId", "declaredByUserId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$5)
       ON CONFLICT DO NOTHING`,
      [hit.id, hit.traceId, hit.referencePrintId, hit.declaredByUserId, hit.createdAt],
    );
  }
}

async function insertVerifications(client, verifications) {
  for (const verification of verifications) {
    await client.query(
      `INSERT INTO "CaseVerification" (id, "caseId", "verifierUserId", "requestedByUserId", status, "requestedAt")
       VALUES ($1,$2,$3,$4,'PENDING',$5)
       ON CONFLICT DO NOTHING`,
      [verification.id, verification.caseId, verification.verifierUserId, verification.requestedByUserId, verification.requestedAt],
    );
  }
}

async function insertLetterhead(client) {
  const result = await client.query(
    `INSERT INTO "ServiceSettings" (id, administration, "serviceName", "postalAddress", "phoneNumber", email, "signatureCity", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [
      SERVICE_SETTINGS_ROW_ID,
      LETTERHEAD.administration,
      LETTERHEAD.serviceName,
      LETTERHEAD.postalAddress,
      LETTERHEAD.phoneNumber,
      LETTERHEAD.email,
      LETTERHEAD.signatureCity,
    ],
  );
  return result.rowCount > 0;
}

/** Même interpolation que percentile.ts, sinon les chiffres annoncés ici ne
 * seraient pas ceux de l'écran. */
function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Les mêmes agrégats que la page d'activité du service, relus après écriture :
 * annoncer des chiffres sans les relire, c'est annoncer le plan, pas le
 * résultat. */
async function report(client) {
  const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

  const open = await client.query(
    `SELECT c.id, c."createdAt", c."operatorUserId", MAX(a."occurredAt") AS "lastActivityAt"
       FROM "InvestigationCase" c
       LEFT JOIN "AuditEvent" a ON a."caseId" = c.id
      WHERE c.status <> 'CLOSED'
      GROUP BY c.id`,
  );
  const closed = await client.query(
    `SELECT "createdAt", "closedAt", "operatorUserId"
       FROM "InvestigationCase"
      WHERE status = 'CLOSED' AND "closedAt" >= $1`,
    [startOfYear],
  );
  const funnel = await client.query(
    `WITH "ofPeriod" AS (
       SELECT id, status FROM "Trace"
        WHERE "withdrawnAt" IS NULL AND "createdAt" >= $1
     )
     SELECT
       (SELECT COUNT(*) FROM "ofPeriod") AS collected,
       (SELECT COUNT(*) FROM "ofPeriod" WHERE status = 'EXPLOITABLE') AS exploitable,
       (SELECT COUNT(DISTINCT m."traceId") FROM "Matching" m
         WHERE m."traceId" IN (SELECT id FROM "ofPeriod")) AS compared,
       (SELECT COUNT(DISTINCT h."traceId") FROM "Hit" h
         WHERE h."withdrawnAt" IS NULL AND h."traceId" IN (SELECT id FROM "ofPeriod")) AS identified`,
    [startOfYear],
  );
  const neverCompared = await client.query(
    `SELECT COUNT(*) AS count
       FROM "Trace" t
      WHERE t."withdrawnAt" IS NULL
        AND t.status = 'EXPLOITABLE'
        AND NOT EXISTS (SELECT 1 FROM "Matching" m WHERE m."traceId" = t.id)`,
  );
  const pending = await client.query(
    `SELECT COUNT(*) AS count FROM "CaseVerification" WHERE status = 'PENDING'`,
  );

  const now = Date.now();
  const days = (from, to) => Math.floor((to - new Date(from).getTime()) / 86_400_000);
  const durations = closed.rows.map((row) => days(row.createdAt, new Date(row.closedAt).getTime()));

  console.log('\nCe que la page d’activité affichera :');
  console.log(`  encours ............................. ${open.rowCount}`);
  console.log(`  dont plus de 90 jours ............... ${open.rows.filter((row) => days(row.createdAt, now) > 90).length}`);
  console.log(`  clos depuis le 1er janvier .......... ${closed.rowCount}`);
  const inDays = (value) => (value === null ? '—' : `${Math.round(value)} jours`);
  console.log(`  délai médian de clôture ............. ${inDays(percentile(durations, 0.5))}`);
  console.log(`  neuvième décile ..................... ${inDays(percentile(durations, 0.9))}`);
  console.log(`  sans acte depuis 30 jours ........... ${open.rows.filter((row) => days(row.lastActivityAt ?? row.createdAt, now) > 30).length}`);
  console.log(`  sans opérateur ...................... ${open.rows.filter((row) => row.operatorUserId === null).length}`);
  console.log(`  traces relevées / exploitables ...... ${funnel.rows[0].collected} / ${funnel.rows[0].exploitable}`);
  console.log(`  comparées / identifiées ............. ${funnel.rows[0].compared} / ${funnel.rows[0].identified}`);
  console.log(`  exploitables jamais comparées ....... ${neverCompared.rows[0].count}`);
  console.log(`  vérifications en attente ............ ${pending.rows[0].count}`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const tenant = await resolveTenantDatabase(options.slug);
  const tenantUrl = requireEnv('TENANT_DATABASE_URL_TEMPLATE').replaceAll(
    '{db}',
    tenant.database_name,
  );

  console.log(
    `Décor de démonstration sur ${options.slug} (${tenant.display_name}) — base ${tenant.database_name}`,
  );

  const pool = new Pool({ connectionString: tenantUrl, max: 1 });
  const client = await pool.connect();
  try {
    const directory = await readDirectory(client);
    const operators = directory.filter((account) => account.role === 'OPERATOR');
    const managers = directory.filter((account) => account.role === 'ADMIN');
    if (operators.length < 6) {
      throw new Error(
        `Six opérateurs au minimum sont attendus dans l'annuaire, ${operators.length} trouvé(s) : poser les comptes avant les dossiers.`,
      );
    }

    const now = atMidday(new Date());
    const cases = planCases(now, operators);
    const images = await borrowImages(client, options);
    const pieces = images
      ? planPieces(cases, images)
      : { traces: [], prints: [], subjects: [], matchings: [], hits: [] };
    const verifications = planVerifications(cases, operators, managers, now);

    if (!images) {
      console.log(
        '\n⚠ Aucune image déposée dans ce tenant : les dossiers seront montés sans pièce.',
      );
      console.log(
        '  Déposer une trace et une empreinte dans un dossier depuis l’application, puis relancer — ou passer --trace-path= et --print-path=.',
      );
      for (const investigation of cases) investigation.traceCount = 0;
    }

    console.log(
      `\n${cases.length} dossiers (${OPEN_CASES.length} en cours, ${CLOSED_COUNT} clos), ${pieces.traces.length} traces, ${pieces.prints.length} empreintes, ${pieces.matchings.length} comparaisons, ${pieces.hits.length} rapprochements, ${verifications.length} vérifications.`,
    );
    console.log(
      `Titulaires : ${[...new Set(cases.map((row) => row.operatorUserId).filter(Boolean))].length} opérateurs sur ${operators.length}.`,
    );

    if (options.dryRun) {
      console.log('\nRien écrit (--dry-run).');
      return;
    }

    await client.query('BEGIN');
    await insertCases(client, cases);
    await insertPieces(client, pieces);
    await insertVerifications(client, verifications);
    const letterhead = await insertLetterhead(client);
    await client.query('COMMIT');

    console.log(
      letterhead
        ? "\nEn-tête de service écrit (SRPTS de Paris)."
        : "\nEn-tête de service déjà renseigné, laissé tel quel.",
    );

    await report(client);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
