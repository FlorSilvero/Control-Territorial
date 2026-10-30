-- Control Territorial — fechas de nacimiento de los pastores
-- Fuente: "Edades pastores.pdf" (listado de la Unión, 41 personas).
--
-- Crea la columna "birthDate" si todavía no existe (no hace falta correr nada
-- en la terminal antes).
--
-- Pegar entero en el editor SQL de Supabase y ejecutar. Es idempotente: se
-- puede correr de nuevo y deja las mismas fechas.
--
-- Cada fila trae dos formas del nombre: la que tiene la base (apellidos
-- compuestos, sin tildes, etc.) y la completa del PDF. Se compara sin tildes,
-- apóstrofos ni mayúsculas, y alcanza con que coincida cualquiera de las dos.
-- Incluye archivados, así el historial también muestra la edad.
--
-- Si un nombre coincide con más de un pastor, aborta. Los que no están en la
-- base (personal de la Asociación que no es pastor distrital) se informan
-- como NOTICE en la pestaña de resultados y se saltean.

BEGIN;

-- ============ 0. Migración 20261030000000_add_pastor_birth_date ============
-- Aplica la columna si falta y la registra igual que lo haría
-- `prisma migrate deploy` (mismo nombre y checksum), para que después Prisma
-- la dé por aplicada y no intente crearla de nuevo.
ALTER TABLE "Pastor" ADD COLUMN IF NOT EXISTS "birthDate" DATE;

INSERT INTO "_prisma_migrations"
  ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text,
       'cb41e67c0d540245a6f8be8d6132237cefeb1fd21e5035baa101bde9dbb113f3',
       now(), '20261030000000_add_pastor_birth_date', now(), 1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE "migration_name" = '20261030000000_add_pastor_birth_date'
);

CREATE TEMP TABLE _nacimientos (
  nombre      text NOT NULL, -- firstName en la base
  apellido    text NOT NULL, -- lastName en la base
  nombre_pdf  text NOT NULL, -- nombre completo como figura en el PDF
  nacimiento  date NOT NULL
) ON COMMIT DROP;

INSERT INTO _nacimientos (nombre, apellido, nombre_pdf, nacimiento) VALUES
  ('Abel Isaías', 'Juchani', 'Abel Isaías Juchani', DATE '1994-12-29'),
  ('Alvaro Iván', 'Gamarra Navarro', 'Alvaro Iván Gamarra', DATE '1994-08-09'),
  ('Bruno Sebastián', 'Salvo', 'Bruno Sebastián Salvo', DATE '1983-03-08'),
  ('Carlos Daniel', 'Ramos Arn', 'Carlos Daniel Ramos Arn', DATE '1969-11-03'),
  ('Cecilio Luis', 'Panessi Ortiz', 'Cecilio Luis Panessi', DATE '1975-01-19'),
  ('Claudio Federico', 'Silva', 'Claudio Federico Silva', DATE '1985-03-20'),
  ('Daniel', 'Apaza', 'Daniel Roberto Apaza Aduviri', DATE '1989-03-15'),
  ('Darío Marcelo', 'Caviglione', 'Dario Marcelo Caviglione', DATE '1968-05-23'),
  ('David Miguel', 'Brizuela', 'David Miguel Brizuela', DATE '1970-09-12'),
  ('Eduardo Mauro', 'Velardo Straface', 'Eduardo Mauro Velardo', DATE '1963-03-23'),
  ('Elbio Daniel', 'D´Acosta', 'Elbio Daniel D''Acosta', DATE '1966-02-21'),
  ('Elvio Salomón', 'Silvero', 'Elvio Salomón Silvero', DATE '1977-04-08'),
  ('Emmanuel Diego', 'Hassanie Iglesias', 'Emmanuel Diego Hassanie', DATE '1987-01-22'),
  ('Fernando Sebastián', 'Lapalma', 'Fernando Sebastián Lapalma Licera', DATE '1975-04-01'),
  ('Gary Eduardo', 'Utz', 'Gary Eduardo Utz', DATE '1990-11-25'),
  ('Guillermo Marcelo', 'Heinze', 'Guillermo Marcelo Heinze', DATE '1972-01-18'),
  ('Javier Alejandro', 'Badano', 'Javier Alejandro Badano', DATE '1977-10-02'),
  ('Jorge Eduardo', 'Santillan', 'Jorge Eduardo Santillán', DATE '1968-09-16'),
  ('Jose Santos', 'Reyes', 'Jose Santos Reyes Carrasco', DATE '1982-05-19'),
  ('Julian Daniel', 'Lorenzo', 'Julián Daniel Lorenzo', DATE '1991-02-01'),
  ('Julian Matias', 'Doni Garcia', 'Julián Matías Doni', DATE '1994-02-17'),
  ('Leandro Elías', 'Maurin', 'Leandro Elías Maurín', DATE '1990-05-15'),
  ('Lucas Esteban', 'Martínez', 'Lucas Esteban Martínez', DATE '1995-02-01'),
  ('Marcelo Claudio', 'Mammana', 'Marcelo Claudio Mammana', DATE '1964-12-31'),
  ('Mario Alberto', 'Costantino', 'Mario Alberto Costantino', DATE '1964-03-29'),
  ('Matias Diego', 'Salinas', 'Matías Diego Salinas', DATE '1994-07-29'),
  ('Moisés Elías', 'Rivero Dupleich', 'Moisés Elías Rivero Dupleich', DATE '1965-04-28'),
  ('Nelson Fabián', 'Stoll', 'Nelson Fabián Stoll', DATE '1975-03-02'),
  ('Nelson Iván', 'Quezada', 'Nelson Iván Quezada', DATE '1987-10-19'),
  ('Nestor Gabriel', 'Cerdá Pissano', 'Néstor Gabriel Cerdá', DATE '1970-02-19'),
  ('Norberto Luis', 'Gonzalez', 'Norberto Luis González', DATE '1970-11-20'),
  ('Oliver', 'Figueroa Solano', 'Oliver Figueroa Solano', DATE '1984-04-06'),
  ('Ramon Antonio', 'Valenzuela', 'Ramón Antonio Valenzuela', DATE '1971-06-30'),
  ('Rubén Darío', 'Barceló', 'Rubén Darío Barceló Simi', DATE '1967-04-29'),
  ('Samuel Elias', 'Menón Aranda', 'Samuel Elías Menón', DATE '1980-11-25'),
  ('Santiago', 'Fornes', 'Santiago David Fornés', DATE '1988-09-29'),
  ('Santiago Ezequiel', 'Felker', 'Santiago Ezequiel Felker', DATE '1993-04-22'),
  ('Wonki', 'Lee', 'Wonki Lee', DATE '1978-11-10');

-- Sin tildes, apóstrofos ni mayúsculas, y con los espacios colapsados.
CREATE FUNCTION pg_temp.norm(s text) RETURNS text AS $$
  SELECT lower(regexp_replace(trim(translate(s,
    'ÁÉÍÓÚÜÑáéíóúüñ´''’',
    'AEIOUUNaeiouun')), '\s+', ' ', 'g'))
$$ LANGUAGE sql IMMUTABLE;

CREATE TEMP TABLE _match ON COMMIT DROP AS
SELECT n.nombre_pdf, n.nacimiento, p.id AS pastor_id
FROM _nacimientos n
LEFT JOIN "Pastor" p
  ON pg_temp.norm(p."firstName" || ' ' || p."lastName")
     IN (pg_temp.norm(n.nombre || ' ' || n.apellido), pg_temp.norm(n.nombre_pdf));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT nombre_pdf FROM _match WHERE pastor_id IS NOT NULL
    GROUP BY nombre_pdf HAVING count(*) > 1
  LOOP
    RAISE EXCEPTION 'Hay más de un pastor que coincide con "%": revisalo a mano', r.nombre_pdf;
  END LOOP;

  FOR r IN SELECT nombre_pdf FROM _match WHERE pastor_id IS NULL ORDER BY 1 LOOP
    RAISE NOTICE 'No está en la base, se saltea: %', r.nombre_pdf;
  END LOOP;
END $$;

UPDATE "Pastor" p
SET "birthDate" = m.nacimiento, "updatedAt" = now()
FROM _match m
WHERE m.pastor_id = p.id
  AND p."birthDate" IS DISTINCT FROM m.nacimiento;

-- Resumen: quién quedó cargado y quiénes están a 5 años o menos de los 65.
SELECT
  p."lastName" || ', ' || p."firstName" AS pastor,
  to_char(p."birthDate", 'DD/MM/YYYY') AS nacimiento,
  date_part('year', age(current_date, p."birthDate"))::int AS edad,
  CASE
    WHEN age(current_date, p."birthDate") >= interval '65 years' THEN '65 cumplidos'
    WHEN age(current_date, p."birthDate") >= interval '60 years' THEN 'menos de 5 años para los 65'
    ELSE ''
  END AS aviso,
  p."archivedAt" IS NOT NULL AS archivado
FROM "Pastor" p
JOIN _match m ON m.pastor_id = p.id
ORDER BY p."birthDate";

COMMIT;
