# Control Territorial

**Control Territorial** es una plataforma de gestión para organizaciones eclesiásticas que centraliza la estructura territorial, las congregaciones, los responsables pastorales y los indicadores de membresía y bautismos. Convierte planillas dispersas y decisiones basadas en datos parciales en una fuente de información trazable, histórica y apta para la gestión.

La aplicación está diseñada para responder una pregunta simple, pero operativamente exigente: **qué está ocurriendo en cada territorio, quién fue responsable en cada período y cómo evolucionan sus indicadores sin perder contexto histórico**.

## El problema que resuelve

En una operación territorial, la información suele vivir en archivos Excel independientes, con nombres escritos de formas distintas, períodos incompletos y cambios de responsables que terminan borrando la historia. Eso dificulta responder con confianza preguntas como:

- ¿Cuántos miembros tiene hoy un distrito si algunas congregaciones no informaron este mes?
- ¿Cuántos bautismos corresponden a un responsable cuando hubo un cambio pastoral durante el año?
- ¿Qué iglesias y grupos componen una jurisdicción, y cómo evolucionaron?
- ¿Cómo importar una planilla masiva sin duplicar, borrar o corromper información existente?

Control Territorial resuelve estos casos mediante un modelo de datos histórico, importaciones validadas y vistas consolidadas por organización, distrito, pastor y congregación.

## Capacidades principales

- Gestión de distritos, iglesias, grupos y pastores.
- Asignación pastoral con vigencia temporal: conserva períodos anteriores y permite conocer el responsable de cada momento.
- Tablero ejecutivo con métricas agregadas, tendencias y gráficos de evolución.
- Vistas de detalle territorial, pastoral y congregacional.
- Registro mensual y anual de miembros y bautismos.
- Importación masiva desde Excel de estructura territorial, responsables y estadísticas.
- Exportación de datos y plantillas Excel compatibles con la importación.
- Búsqueda global y normalización de texto para encontrar información aun con diferencias de acentos o escritura.
- Archivado y restauración no destructivos de entidades operativas.
- Autenticación con credenciales y perfiles `ADMIN`, `EDITOR` y `VIEWER`.
- Aislamiento por organización (multi-tenant) y registro de auditoría para operaciones de dominio.
- Manifest web instalable para uso como aplicación progresiva.

## Decisiones de diseño que importan

### Métricas correctas: stock vs. flujo

La membresía y los bautismos no se pueden agregar de la misma manera:

- **Miembros** es un *stock*: representa una fotografía en el tiempo. Para construir el total de un distrito, el sistema toma el último valor válido de cada congregación y lo arrastra hacia adelante cuando ese período no fue informado.
- **Bautismos** es un *flujo*: representa eventos ocurridos durante un período, por lo que se suma.

Esta distinción evita el error habitual de mostrar que un distrito “perdió” miembros simplemente porque una de sus iglesias no cargó datos ese mes.

### Historial pastoral como dato de primera clase

Las asignaciones no se sobrescriben. `PastorAssignment` funciona como una tabla temporal: una asignación activa no tiene fecha de finalización y, al reasignar, el período anterior se cierra. Así se preserva el recorrido institucional y se pueden atribuir las métricas al responsable correspondiente.

Para los cierres anuales que atraviesan más de una asignación, los bautismos se distribuyen proporcionalmente según los días de vigencia de cada período. Esto mantiene consistencia entre los totales de distrito y los resultados atribuidos a cada pastor.

### Importaciones masivas seguras

Las planillas no se procesan “a ciegas”. Antes de escribir, la aplicación valida encabezados, tipos, rangos, duplicados, referencias a distritos e iglesias y ambigüedades de nombres. Luego persiste los datos en transacciones por lotes y devuelve errores asociados a filas concretas.

La importación estructural es deliberadamente un **upsert no destructivo**: crea o actualiza lo que declara la planilla, pero nunca archiva registros ausentes. Esto evita que un archivo parcial borre parte de la operación.

## Arquitectura

```text
Navegador / PWA
        │
        ▼
Next.js App Router ── Server Components + Server Actions + Route Handlers
        │
        ├── Auth.js + bcryptjs ── sesiones JWT y control de roles
        │
        ▼
Prisma 7 + node-postgres adapter
        │
        ▼
Supabase PostgreSQL
  organizaciones · distritos · congregaciones · pastores
  asignaciones históricas · estadísticas · auditoría
```

Las consultas y mutaciones de dominio se ejecutan del lado del servidor. Cada operación resuelve la sesión actual y se filtra por `organizationId`, de modo que el aislamiento multi-organización forma parte de la capa de datos y no sólo de la interfaz.

## Tecnologías

| Área | Tecnologías | Uso en el proyecto |
| --- | --- | --- |
| Aplicación web | Next.js 16, React 19, TypeScript | Renderizado híbrido, rutas, componentes y lógica de servidor tipada. |
| Persistencia | PostgreSQL en Supabase, Prisma 7, `pg` | Modelo relacional, migraciones y acceso tipado a datos. |
| Autenticación | Auth.js / NextAuth v5, bcryptjs | Inicio de sesión con credenciales, JWT y protección de rutas. |
| Interfaz | Tailwind CSS 4, shadcn/ui, Base UI, Lucide | Diseño consistente, accesible y adaptable. |
| Visualización | Recharts | Gráficos de evolución y comparación de indicadores. |
| Intercambio de datos | ExcelJS | Lectura, validación, exportación y plantillas `.xlsx`. |
| Validación | Zod | Validación de formularios, credenciales y entradas de usuario. |
| Calidad | ESLint, Vitest | Estándares estáticos y pruebas para la lógica de agregación e importación. |

## Modelo de dominio

```text
Organization
 ├── User
 ├── District
 │    ├── Church (IGLESIA | GRUPO)
 │    │    └── StatisticRecord (mensual o anual)
 │    └── PastorAssignment ─── Pastor
 └── AuditLog
```

Principios del modelo:

- Los datos de dominio se asocian a una organización.
- Las entidades operativas se archivan en lugar de eliminarse físicamente.
- Las estadísticas son snapshots por congregación y período, con unicidad por iglesia, año y mes.
- La auditoría registra quién ejecutó las acciones relevantes y sobre qué entidad.

## Puesta en marcha local

### Requisitos

- Node.js 20 o superior.
- npm.
- Un proyecto de Supabase PostgreSQL, o una base PostgreSQL compatible.

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copiá el ejemplo y completá las credenciales:

```bash
cp .env.example .env.local
```

```env
AUTH_SECRET="generar-con-openssl-rand-base64-32"
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://...:5432/postgres?sslmode=require"
```

- `DATABASE_URL` se usa en tiempo de ejecución y debe apuntar al **transaction pooler** de Supabase (puerto `6543`) con `pgbouncer=true`.
- `DIRECT_URL` se usa para migraciones y scripts, mediante la conexión directa (puerto `5432`).
- `AUTH_SECRET` debe ser un secreto aleatorio distinto por entorno. Puede generarse con `openssl rand -base64 32`.

### 3. Crear el esquema y datos iniciales

```bash
npx prisma migrate deploy
npm run seed
```

> El seed carga datos iniciales de demostración y vuelve a crear los datos de dominio de la organización `default`. No lo ejecutes sobre una base con información productiva.

### 4. Iniciar la aplicación

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

El seed crea el usuario inicial `admin@iglesia.app` con contraseña `admin1234`. Cambiá esas credenciales antes de exponer cualquier entorno.

## Scripts disponibles

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Inicia el entorno de desarrollo. |
| `npm run build` | Genera el cliente Prisma y compila la aplicación para producción. |
| `npm run start` | Sirve la compilación de producción. |
| `npm run lint` | Ejecuta ESLint. |
| `npm test` | Ejecuta la suite de Vitest. |
| `npm run test:watch` | Ejecuta las pruebas en modo observación. |
| `npm run seed` | Carga el conjunto inicial de datos. |
| `npm run import:dump -- <archivo.json>` | Migra un respaldo del esquema local anterior a PostgreSQL, sólo si la base destino está vacía. |

Para crear una migración durante desarrollo:

```bash
npx prisma migrate dev --name descripcion-del-cambio
```

## Despliegue

La aplicación está preparada para desplegarse en Vercel con Supabase como base de datos:

1. Configurá `AUTH_SECRET`, `DATABASE_URL` y `DIRECT_URL` en el proveedor de despliegue.
2. Aplicá las migraciones con una conexión directa: `npx prisma migrate deploy`.
3. Ejecutá `npm run build` como verificación de compilación.
4. Desplegá la aplicación.

El cliente de Prisma utiliza una única conexión por instancia contra el pooler transaccional, una decisión importante para no agotar conexiones en entornos serverless.

## Calidad, seguridad y trazabilidad

- Rutas protegidas desde `proxy.ts`; la configuración usada en el Edge runtime no carga dependencias exclusivas de Node.js.
- Contraseñas hasheadas con bcrypt y credenciales validadas con límites de longitud.
- Permisos de escritura limitados a `ADMIN` y `EDITOR`; las acciones sensibles pueden exigir administración.
- Cabeceras de seguridad para impedir *sniffing* de contenido, embebidos no deseados y permisos de navegador innecesarios.
- Validación de archivos antes de persistir información y transacciones por lotes para mantener integridad y rendimiento.
- Auditoría centralizada de altas, cambios, archivados, restauraciones, reasignaciones y operaciones estadísticas.

## Desafíos de ingeniería resueltos

El proyecto enfrentó problemas que aparecen en sistemas reales de gestión, no sólo en una interfaz administrativa:

1. **Evitar agregados engañosos con períodos incompletos.** Se modeló explícitamente la diferencia entre membresía (*stock*) y bautismos (*flujo*), usando arrastre de snapshots para no subestimar totales.
2. **Preservar la responsabilidad histórica.** Las reasignaciones pastorales no alteran el pasado; el modelo temporal mantiene ventanas de vigencia y permite atribución consistente de métricas.
3. **Hacer convivir Excel y datos confiables.** Las importaciones toleran alias de encabezados, normalizan texto y reportan errores por fila sin transformar una carga parcial en una operación destructiva
4. **Preparar la plataforma para escalar organizacionalmente.** El aislamiento por organización está incorporado desde el modelo y las consultas, evitando una refactorización riesgosa al incorporar nuevos tenants.
5. **Operar Prisma en serverless sin agotar PostgreSQL.** Se separaron las conexiones de runtime y migración: el pooler transaccional sirve a la aplicación, mientras que las migraciones usan conexión directa.
6. **Evolucionar sin perder datos.** Archivado lógico, auditoría y migraciones permiten mejorar la estructura sin convertir los cambios de producto en pérdidas de información.

## Estructura del repositorio

```text
app/                 Rutas, pantallas, APIs y manifest de Next.js
components/          Componentes de dominio, dashboard e interfaz
lib/                 Autenticación, acciones de servidor, consultas y reglas de negocio
prisma/              Esquema, migraciones, seed e importación de datos históricos
public/              Íconos y recursos estáticos
```

## Licencia

Proyecto privado. Todos los derechos reservados.
