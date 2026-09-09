/**
 * Genera prisma/data/pastores-historicos.sql: el historial de responsables por
 * distrito 2021-2026, para pegar en el editor SQL de Supabase.
 *
 * Igual que el de bautismos, no lleva ids adentro: resuelve distrito y pastor
 * por nombre contra la base al ejecutarse. Los pastores que ya no están se
 * crean archivados; los vigentes tienen que existir ya (si no, aborta, porque
 * crearlos de nuevo sería duplicarlos).
 *
 * Uso: npm run gen:pastores-sql
 */
import fs from "node:fs"
import path from "node:path"
import type { BautismosPayload } from "../prisma/data/bautismos-mapeo"
import { resolvePastorAssignments } from "../prisma/data/pastores-mapeo"
import { DISTRITOS_2026 } from "../prisma/data/distritos-2026"

const DATA_DIR = path.join(import.meta.dirname, "..", "prisma", "data")
const OUT = path.join(DATA_DIR, "pastores-historicos.sql")

const payload = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "bautismos-historicos.json"), "utf8"),
) as BautismosPayload

const lastYear = Math.max(...payload.meta.years)
const { periods, problems } = resolvePastorAssignments(
  payload.rows,
  DISTRITOS_2026.map((d) => d.name),
  lastYear,
)
if (problems.length > 0) {
  console.error("[gen] el mapeo tiene problemas, no se genera el SQL:")
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`

const values = periods
  .map((p) => {
    const desde = `${p.fromYear}-01-01`
    const hasta = p.toYear === null ? "NULL" : `TIMESTAMP '${p.toYear}-12-31'`
    return `  (${quote(p.district)}, ${quote(p.pastor.lastName)}, ${quote(p.pastor.firstName)}, TIMESTAMP '${desde}', ${hasta})`
  })
  .join(",\n")

const abiertos = periods.filter((p) => p.toYear === null).length
const personas = new Set(periods.map((p) => `${p.pastor.lastName}|${p.pastor.firstName}`)).size

const sql = `-- Control Territorial — responsables por distrito ${payload.meta.years[0]}-${lastYear}
-- Generado por scripts/gen-pastores-sql.ts desde ${payload.meta.source}
--
-- Pegar entero en el editor SQL de Supabase y ejecutar. Es idempotente y va
-- junto con bautismos-historicos.sql (el orden entre los dos no importa).
--
-- ${periods.length} períodos sobre ${personas} personas. Los ${abiertos} períodos que llegan a ${lastYear}
-- no crean asignaciones nuevas: le corren la fecha de inicio a la asignación
-- vigente que ya está en la base, para que diga desde cuándo está el pastor.
--
-- Los pastores que ya no están en el padrón se crean archivados, así no
-- aparecen en el listado de Pastores pero sí en el historial de cada distrito.
--
-- Los distritos disueltos (San Justo, Liniers, Villa Madero, Guillermo Hudson,
-- Cañuelas, Costa Atlántica, Moreno - Merlo, Merlo Sur) quedan fuera: una
-- asignación cuelga de un distrito, y mandarlas al distrito que las absorbió
-- dejaría varios pastores solapados en el mismo distrito y el mismo año.
--
-- Si algo no resuelve, la transacción se revierte y no se escribe nada.

BEGIN;

-- ============ 1. Historial de la planilla ============
-- hasta NULL = período vigente.
CREATE TEMP TABLE _asignaciones (
  distrito text      NOT NULL,
  apellido text      NOT NULL,
  nombre   text      NOT NULL,
  desde    timestamp NOT NULL,
  hasta    timestamp
) ON COMMIT DROP;

INSERT INTO _asignaciones (distrito, apellido, nombre, desde, hasta) VALUES
${values};

-- ============ 2. Organización ============
-- Si tu base tiene más de una organización, reemplazá el SELECT por
-- SELECT id FROM "Organization" WHERE slug = 'tu-slug'.
CREATE TEMP TABLE _org ON COMMIT DROP AS
SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1;

DO $$
BEGIN
  IF (SELECT count(*) FROM "Organization") <> 1 THEN
    RAISE EXCEPTION 'Hay % organizaciones: elegí una editando el SELECT del paso 2',
      (SELECT count(*) FROM "Organization");
  END IF;
END $$;

-- ============ 3. Controles previos ============
DO $$
DECLARE faltantes text;
BEGIN
  -- 3a. Todo distrito de la planilla tiene que existir.
  SELECT string_agg(DISTINCT a.distrito, ', ' ORDER BY a.distrito) INTO faltantes
  FROM _asignaciones a
  WHERE NOT EXISTS (
    SELECT 1 FROM "District" d
    WHERE d."organizationId" = (SELECT id FROM _org)
      AND d."archivedAt" IS NULL
      AND lower(btrim(d."name")) = lower(btrim(a.distrito))
  );
  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'No se encontraron estos distritos: %', faltantes;
  END IF;

  -- 3b. Los responsables vigentes tienen que estar ya cargados: crearlos acá
  -- sería duplicar al pastor que la app ya tiene asignado al distrito.
  SELECT string_agg(DISTINCT a.apellido || ', ' || a.nombre, ' | ' ORDER BY a.apellido || ', ' || a.nombre)
    INTO faltantes
  FROM _asignaciones a
  WHERE a.hasta IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "Pastor" p
      WHERE p."organizationId" = (SELECT id FROM _org)
        AND lower(btrim(p."lastName"))  = lower(btrim(a.apellido))
        AND lower(btrim(p."firstName")) = lower(btrim(a.nombre))
    );
  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Estos responsables vigentes no están en la base con ese nombre exacto: %', faltantes;
  END IF;
END $$;

-- ============ 4. Pastores que faltan (se crean archivados) ============
INSERT INTO "Pastor" ("id", "firstName", "lastName", "createdAt", "updatedAt", "archivedAt", "organizationId")
SELECT DISTINCT ON (lower(btrim(a.apellido)), lower(btrim(a.nombre)))
  'past' || md5(lower(btrim(a.apellido)) || '|' || lower(btrim(a.nombre))),
  a.nombre,
  a.apellido,
  now(),
  now(),
  now(), -- archivado: ya no está en el padrón
  (SELECT id FROM _org)
FROM _asignaciones a
WHERE NOT EXISTS (
  SELECT 1 FROM "Pastor" p
  WHERE p."organizationId" = (SELECT id FROM _org)
    AND lower(btrim(p."lastName"))  = lower(btrim(a.apellido))
    AND lower(btrim(p."firstName")) = lower(btrim(a.nombre))
)
ON CONFLICT ("id") DO NOTHING;

-- ============ 5. Resolución ============
CREATE TEMP TABLE _resuelto ON COMMIT DROP AS
SELECT a.*, d.id AS district_id, p.id AS pastor_id
FROM _asignaciones a
JOIN "District" d
  ON  d."organizationId" = (SELECT id FROM _org)
  AND d."archivedAt" IS NULL
  AND lower(btrim(d."name")) = lower(btrim(a.distrito))
JOIN "Pastor" p
  ON  p."organizationId" = (SELECT id FROM _org)
  AND lower(btrim(p."lastName"))  = lower(btrim(a.apellido))
  AND lower(btrim(p."firstName")) = lower(btrim(a.nombre));

DO $$
BEGIN
  IF (SELECT count(*) FROM _resuelto) <> (SELECT count(*) FROM _asignaciones) THEN
    RAISE EXCEPTION 'La resolución devolvió % filas para % del historial: hay nombres repetidos',
      (SELECT count(*) FROM _resuelto), (SELECT count(*) FROM _asignaciones);
  END IF;
END $$;

-- ============ 6. Períodos cerrados ============
INSERT INTO "PastorAssignment" (
  "id", "startDate", "endDate", "createdAt", "updatedAt",
  "organizationId", "pastorId", "districtId"
)
SELECT
  'asig' || md5(r.pastor_id || ':' || r.district_id || ':' || r.desde),
  r.desde,
  r.hasta,
  now(),
  now(),
  (SELECT id FROM _org),
  r.pastor_id,
  r.district_id
FROM _resuelto r
WHERE r.hasta IS NOT NULL
ON CONFLICT ("id") DO UPDATE
  SET "startDate" = EXCLUDED."startDate",
      "endDate"   = EXCLUDED."endDate",
      "updatedAt" = now();

-- ============ 7. Períodos vigentes ============
-- No se crean: se le corre hacia atrás la fecha de inicio a la asignación
-- abierta que ya existe, así el distrito muestra desde cuándo está el pastor.
DO $$
DECLARE desalineados text;
BEGIN
  SELECT string_agg(r.distrito || ' (planilla: ' || r.apellido || ', ' || r.nombre || ')', ' | ' ORDER BY r.distrito)
    INTO desalineados
  FROM _resuelto r
  WHERE r.hasta IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "PastorAssignment" pa
      WHERE pa."districtId" = r.district_id
        AND pa."pastorId"   = r.pastor_id
        AND pa."endDate" IS NULL
    );
  IF desalineados IS NOT NULL THEN
    RAISE EXCEPTION 'En estos distritos el pastor vigente en la base no es el de la planilla: %', desalineados;
  END IF;
END $$;

UPDATE "PastorAssignment" pa
SET "startDate" = r.desde,
    "updatedAt" = now()
FROM _resuelto r
WHERE r.hasta IS NULL
  AND pa."districtId" = r.district_id
  AND pa."pastorId"   = r.pastor_id
  AND pa."endDate" IS NULL
  AND pa."startDate" > r.desde;

COMMIT;

-- ============ 8. Verificación ============
-- Esperado: ${periods.length} períodos, ${abiertos} vigentes.
SELECT d."name" AS distrito,
       p."lastName" || ', ' || p."firstName" AS pastor,
       to_char(pa."startDate", 'YYYY-MM-DD') AS desde,
       coalesce(to_char(pa."endDate", 'YYYY-MM-DD'), 'vigente') AS hasta
FROM "PastorAssignment" pa
JOIN "District" d ON d.id = pa."districtId"
JOIN "Pastor"   p ON p.id = pa."pastorId"
ORDER BY d."name", pa."startDate";
`

fs.writeFileSync(OUT, sql)
console.log(`[gen] ${periods.length} períodos (${abiertos} vigentes), ${personas} personas -> ${path.relative(process.cwd(), OUT)}`)
