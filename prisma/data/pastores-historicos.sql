-- Control Territorial — responsables por distrito 2021-2026
-- Generado por scripts/gen-pastores-sql.ts desde Bautismos 2010-2026.xlsx
--
-- Pegar entero en el editor SQL de Supabase y ejecutar. Es idempotente y va
-- junto con bautismos-historicos.sql (el orden entre los dos no importa).
--
-- 72 períodos sobre 51 personas. Los 30 períodos que llegan a 2026
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
  ('Avellaneda', 'Stoll', 'Nelson Fabián', TIMESTAMP '2021-01-01', TIMESTAMP '2023-12-31'),
  ('Avellaneda', 'Cerdá Pissano', 'Nestor Gabriel', TIMESTAMP '2024-01-01', NULL),
  ('Berazategui', 'Cabral Liendro', 'Rubén Marcelo', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Berazategui', 'Maurin', 'Leandro Elías', TIMESTAMP '2023-01-01', NULL),
  ('Boedo', 'Quiñones', 'Marcelo', TIMESTAMP '2021-01-01', TIMESTAMP '2025-12-31'),
  ('Boedo', 'Caviglione', 'Darío Marcelo', TIMESTAMP '2026-01-01', NULL),
  ('Castelar', 'Cesano Pochyly', 'Alejandro Daniel', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Castelar', 'Costantino', 'Mario Alberto', TIMESTAMP '2023-01-01', TIMESTAMP '2024-12-31'),
  ('Castelar', 'Ramos Arn', 'Carlos Daniel', TIMESTAMP '2025-01-01', NULL),
  ('Coreana', 'Mun', 'Young Sun', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Coreana', 'Lee', 'Wonki', TIMESTAMP '2023-01-01', NULL),
  ('Del Centro', 'Maldonado', 'Darío Fabián', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('Del Centro', 'Giordana', 'Roberto', TIMESTAMP '2022-01-01', TIMESTAMP '2023-12-31'),
  ('Del Centro', 'Brizuela', 'David Miguel', TIMESTAMP '2024-01-01', NULL),
  ('Florencio Varela', 'Menón Aranda', 'Samuel Elias', TIMESTAMP '2021-01-01', TIMESTAMP '2023-12-31'),
  ('Florencio Varela', 'Villar', 'Luciano Martín', TIMESTAMP '2024-01-01', TIMESTAMP '2025-12-31'),
  ('Florencio Varela', 'Fornes', 'Santiago', TIMESTAMP '2026-01-01', NULL),
  ('González Catán', 'Santillan', 'Jorge Eduardo', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('González Catán', 'Pino', 'Lucio', TIMESTAMP '2022-01-01', TIMESTAMP '2024-12-31'),
  ('González Catán', 'Martínez', 'Lucas Esteban', TIMESTAMP '2025-01-01', NULL),
  ('Guernica', 'Olivera', 'Juan Ricardo', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('Guernica', 'Escandriolo', 'Darío', TIMESTAMP '2022-01-01', TIMESTAMP '2024-12-31'),
  ('Guernica', 'Juchani', 'Abel Isaías', TIMESTAMP '2025-01-01', NULL),
  ('Instituto Balcarce', 'Aguirre Luna Urrejola', 'Javier', TIMESTAMP '2021-01-01', TIMESTAMP '2023-12-31'),
  ('Instituto Balcarce', 'Gamarra Navarro', 'Alvaro Iván', TIMESTAMP '2024-01-01', NULL),
  ('La Costa', 'Álvarez', 'Néstor Rubén', TIMESTAMP '2022-01-01', TIMESTAMP '2025-12-31'),
  ('La Costa', 'Lorenzo', 'Julian Daniel', TIMESTAMP '2026-01-01', NULL),
  ('La Plata Centro', 'Rivero Dupleich', 'Moisés Elías', TIMESTAMP '2021-01-01', TIMESTAMP '2024-12-31'),
  ('La Plata Centro', 'Lapalma', 'Fernando Sebastián', TIMESTAMP '2025-01-01', NULL),
  ('La Plata Sur', 'Gandur', 'Nicolás', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('La Plata Sur', 'Gonzalez', 'Norberto Luis', TIMESTAMP '2023-01-01', NULL),
  ('Laferrere', 'Álvarez', 'Néstor Rubén', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('Laferrere', 'Salvo', 'Bruno Sebastián', TIMESTAMP '2022-01-01', TIMESTAMP '2024-12-31'),
  ('Laferrere', 'Silva', 'Claudio Federico', TIMESTAMP '2025-01-01', NULL),
  ('Lomas de Zamora', 'Blanco Rivero', 'Martin Marcelo', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Lomas de Zamora', 'Cabral Liendro', 'Rubén Marcelo', TIMESTAMP '2023-01-01', TIMESTAMP '2024-12-31'),
  ('Lomas de Zamora', 'Santillan', 'Jorge Eduardo', TIMESTAMP '2025-01-01', NULL),
  ('Mar del Plata Centro', 'D´Acosta', 'Elbio Daniel', TIMESTAMP '2021-01-01', TIMESTAMP '2025-12-31'),
  ('Mar del Plata Centro', 'Reyes', 'Jose Santos', TIMESTAMP '2026-01-01', NULL),
  ('Mar del Plata Sur', 'Boggiano', 'Daniel', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Mar del Plata Sur', 'Doni Garcia', 'Julian Matias', TIMESTAMP '2023-01-01', NULL),
  ('Merlo', 'Heinze', 'Guillermo Marcelo', TIMESTAMP '2025-01-01', NULL),
  ('Monte Grande', 'Figueroa Solano', 'Oliver', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('Monte Grande', 'Reyes', 'Jose Santos', TIMESTAMP '2022-01-01', TIMESTAMP '2025-12-31'),
  ('Monte Grande', 'Mammana', 'Marcelo Claudio', TIMESTAMP '2026-01-01', NULL),
  ('Moreno', 'Badano', 'Javier Alejandro', TIMESTAMP '2022-01-01', TIMESTAMP '2024-12-31'),
  ('Moreno', 'Velardo Straface', 'Eduardo Mauro', TIMESTAMP '2025-01-01', NULL),
  ('Morón', 'Giordana', 'Roberto', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('Morón', 'Velardo Straface', 'Eduardo Mauro', TIMESTAMP '2022-01-01', TIMESTAMP '2024-12-31'),
  ('Morón', 'Badano', 'Javier Alejandro', TIMESTAMP '2025-01-01', NULL),
  ('Núñez', 'Costantino', 'Mario Alberto', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Núñez', 'Perez Sumic', 'Mariano Sebastián', TIMESTAMP '2023-01-01', TIMESTAMP '2024-12-31'),
  ('Núñez', 'Barceló', 'Rubén Darío', TIMESTAMP '2025-01-01', NULL),
  ('Palermo', 'Cerdá Pissano', 'Nestor Gabriel', TIMESTAMP '2021-01-01', TIMESTAMP '2023-12-31'),
  ('Palermo', 'Stoll', 'Nelson Fabián', TIMESTAMP '2024-01-01', NULL),
  ('Parque Avellaneda', 'Lapalma', 'Fernando Sebastián', TIMESTAMP '2021-01-01', TIMESTAMP '2024-12-31'),
  ('Parque Avellaneda', 'Salvo', 'Bruno Sebastián', TIMESTAMP '2025-01-01', NULL),
  ('Rafael Calzada', 'Britez', 'David Andres', TIMESTAMP '2021-01-01', TIMESTAMP '2021-12-31'),
  ('Rafael Calzada', 'Lorenzo', 'Julian Daniel', TIMESTAMP '2023-01-01', TIMESTAMP '2025-12-31'),
  ('Rafael Calzada', 'Valenzuela', 'Ramon Antonio', TIMESTAMP '2026-01-01', NULL),
  ('San Justo - Liniers', 'Rivero Dupleich', 'Moisés Elías', TIMESTAMP '2025-01-01', NULL),
  ('Tandil', 'Gonzalez', 'Norberto Luis', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Tandil', 'Gandur', 'Nicolás', TIMESTAMP '2023-01-01', TIMESTAMP '2024-12-31'),
  ('Tandil', 'Pino', 'Lucio', TIMESTAMP '2025-01-01', TIMESTAMP '2025-12-31'),
  ('Tandil', 'Salinas', 'Matias Diego', TIMESTAMP '2026-01-01', NULL),
  ('Valentín Alsina', 'Felker', 'Santiago Ezequiel', TIMESTAMP '2021-01-01', TIMESTAMP '2022-12-31'),
  ('Valentín Alsina', 'Ramos Arn', 'Carlos Daniel', TIMESTAMP '2023-01-01', TIMESTAMP '2024-12-31'),
  ('Valentín Alsina', 'Hassanie Iglesias', 'Emmanuel Diego', TIMESTAMP '2025-01-01', NULL),
  ('Villa Celina', 'Felker', 'Santiago Ezequiel', TIMESTAMP '2024-01-01', TIMESTAMP '2025-12-31'),
  ('Villa Celina', 'Panessi Ortiz', 'Cecilio Luis', TIMESTAMP '2026-01-01', NULL),
  ('Villa Lamadrid', 'Villar', 'Luciano Martín', TIMESTAMP '2021-01-01', TIMESTAMP '2023-12-31'),
  ('Villa Lamadrid', 'Menón Aranda', 'Samuel Elias', TIMESTAMP '2024-01-01', NULL);

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
-- Esperado: 72 períodos, 30 vigentes.
SELECT d."name" AS distrito,
       p."lastName" || ', ' || p."firstName" AS pastor,
       to_char(pa."startDate", 'YYYY-MM-DD') AS desde,
       coalesce(to_char(pa."endDate", 'YYYY-MM-DD'), 'vigente') AS hasta
FROM "PastorAssignment" pa
JOIN "District" d ON d.id = pa."districtId"
JOIN "Pastor"   p ON p.id = pa."pastorId"
ORDER BY d."name", pa."startDate";
