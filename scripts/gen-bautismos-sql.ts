/**
 * Genera prisma/data/bautismos-historicos.sql para pegar en el editor SQL de
 * Supabase, alternativa a `npm run import:bautismos` cuando los puertos de
 * Postgres no son alcanzables.
 *
 * El SQL no lleva ids adentro: resuelve distrito e iglesia por nombre contra la
 * base al momento de ejecutarse, así que no depende de que los ids locales
 * coincidan con los de Supabase. Antes de escribir verifica que cada
 * congregación exista y que los totales por año den los de la planilla; si algo
 * falla, RAISE EXCEPTION revierte la transacción entera.
 *
 * Uso: npm run gen:bautismos-sql
 */
import fs from "node:fs"
import path from "node:path"
import { resolveBautismos, type BautismosPayload } from "../prisma/data/bautismos-mapeo"
import { DISTRITOS_2026 } from "../prisma/data/distritos-2026"

const DATA_DIR = path.join(import.meta.dirname, "..", "prisma", "data")
const OUT = path.join(DATA_DIR, "bautismos-historicos.sql")

const payload = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "bautismos-historicos.json"), "utf8"),
) as BautismosPayload

// El padrón sembrado, con ids sintéticos: acá sólo interesan los nombres, que
// son lo que el SQL usará para resolver contra la base real.
const districts = DISTRITOS_2026.map((d, i) => ({ id: `d${i}`, name: d.name }))
const churches = DISTRITOS_2026.flatMap((d, i) =>
  d.congregations.map((c, j) => ({ id: `c${i}-${j}`, name: c.name, districtId: `d${i}` })),
)

const { periods, problems } = resolveBautismos(payload.rows, districts, churches)
if (problems.length > 0) {
  console.error("[gen] el mapeo tiene problemas, no se genera el SQL:")
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`

const values = periods
  .map(
    (p) =>
      `  (${quote(p.districtName)}, ${quote(p.churchName)}, ${p.year}, ${p.month}, ${p.baptisms})`,
  )
  .join(",\n")

const totalsCheck = payload.meta.years
  .map((year) => `    (${year}, ${payload.meta.totals[String(year)]})`)
  .join(",\n")

const sql = `-- Control Territorial — bautismos históricos ${payload.meta.years[0]}-${payload.meta.years.at(-1)}
-- Generado por scripts/gen-bautismos-sql.ts desde ${payload.meta.source}
--
-- Pegar entero en el editor SQL de Supabase y ejecutar. Es idempotente:
-- correrlo dos veces deja la base igual.
--
-- Qué hace: el total mensual de bautismos de cada distrito se imputa a su
-- congregación cabecera (la homónima del distrito, o la de mayor membresía
-- cuando no hay homónima). Los distritos que ya no existen se imputan a la
-- congregación que hoy los representa, así que no se pierde ningún bautismo.
-- memberCount va en 0 porque la planilla no informa membresía mensual; si el
-- período ya tiene un registro, se respeta su memberCount y sólo se actualiza
-- baptismCount.
--
-- Si algo no resuelve, la transacción se revierte y no se escribe nada.

BEGIN;

-- ============ 1. Datos de la planilla ============
CREATE TEMP TABLE _bautismos (
  distrito  text    NOT NULL,
  iglesia   text    NOT NULL,
  anio      integer NOT NULL,
  mes       integer NOT NULL,
  bautismos integer NOT NULL
) ON COMMIT DROP;

INSERT INTO _bautismos (distrito, iglesia, anio, mes, bautismos) VALUES
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

-- ============ 3. Resolución por nombre ============
CREATE TEMP TABLE _resuelto ON COMMIT DROP AS
SELECT b.*, c.id AS church_id
FROM _bautismos b
JOIN "District" d
  ON  d."organizationId" = (SELECT id FROM _org)
  AND d."archivedAt" IS NULL
  AND lower(btrim(d."name")) = lower(btrim(b.distrito))
JOIN "Church" c
  ON  c."districtId" = d.id
  AND c."archivedAt" IS NULL
  AND lower(btrim(c."name")) = lower(btrim(b.iglesia));

-- ============ 4. Controles ============
DO $$
DECLARE
  faltantes text;
  esperado  integer;
  obtenido  integer;
BEGIN
  -- 4a. Toda congregación de la planilla tiene que existir en la base.
  SELECT string_agg(DISTINCT b.distrito || ' / ' || b.iglesia, ', ' ORDER BY b.distrito || ' / ' || b.iglesia)
    INTO faltantes
  FROM _bautismos b
  WHERE NOT EXISTS (
    SELECT 1
    FROM "District" d
    JOIN "Church" c ON c."districtId" = d.id
                   AND c."archivedAt" IS NULL
                   AND lower(btrim(c."name")) = lower(btrim(b.iglesia))
    WHERE d."organizationId" = (SELECT id FROM _org)
      AND d."archivedAt" IS NULL
      AND lower(btrim(d."name")) = lower(btrim(b.distrito))
  );
  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'No se encontraron estas congregaciones: %', faltantes;
  END IF;

  -- 4b. Ningún nombre puede haber resuelto a dos congregaciones distintas.
  IF (SELECT count(*) FROM _resuelto) <> (SELECT count(*) FROM _bautismos) THEN
    RAISE EXCEPTION 'La resolución devolvió % filas para % de la planilla: hay nombres de congregación repetidos dentro de un distrito',
      (SELECT count(*) FROM _resuelto), (SELECT count(*) FROM _bautismos);
  END IF;

  -- 4c. Los totales por año tienen que dar los de la planilla.
  FOR esperado, obtenido IN
    SELECT t.total, coalesce(sum(r.bautismos), 0)
    FROM (VALUES
${totalsCheck}
    ) AS t(anio, total)
    LEFT JOIN _resuelto r ON r.anio = t.anio
    GROUP BY t.anio, t.total
    ORDER BY t.anio
  LOOP
    IF esperado <> obtenido THEN
      RAISE EXCEPTION 'Los totales no coinciden: se mapearon % bautismos de %', obtenido, esperado;
    END IF;
  END LOOP;
END $$;

-- ============ 5. Escritura ============
INSERT INTO "StatisticRecord" (
  "id", "period", "year", "month", "memberCount", "baptismCount",
  "createdAt", "updatedAt", "organizationId", "churchId"
)
SELECT
  'baut' || md5(r.church_id || ':' || r.anio || ':' || r.mes),
  'MONTHLY'::"StatPeriod",
  r.anio,
  r.mes,
  0,
  r.bautismos,
  now(),
  now(),
  (SELECT id FROM _org),
  r.church_id
FROM _resuelto r
ON CONFLICT ("churchId", "year", "month") DO UPDATE
  SET "baptismCount" = EXCLUDED."baptismCount",
      "updatedAt"    = now();

COMMIT;

-- ============ 6. Verificación ============
-- Esperado: ${payload.meta.years.map((y) => `${y}=${payload.meta.totals[String(y)]}`).join(", ")}
SELECT "year" AS anio,
       sum("baptismCount") AS bautismos,
       count(*) AS registros
FROM "StatisticRecord"
WHERE "year" BETWEEN ${payload.meta.years[0]} AND ${payload.meta.years.at(-1)}
GROUP BY "year"
ORDER BY "year";
`

fs.writeFileSync(OUT, sql)
console.log(`[gen] ${periods.length} períodos -> ${path.relative(process.cwd(), OUT)}`)
