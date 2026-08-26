#!/usr/bin/env node
const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const ROOT = path.join(__dirname, "..")
const RESOURCES_DIR = path.join(ROOT, "electron-resources")
const APP_DIR = path.join(RESOURCES_DIR, "app")
const DB_TEMPLATE_DIR = path.join(RESOURCES_DIR, "db-template")
const BUILD_DIR = path.join(ROOT, "build")
const SEED_DB_PATH = path.join(BUILD_DIR, "seed-template.db")
const NATIVE_MODULE = "better_sqlite3.node"
// Sólo el node_modules de la raíz conserva los fuentes C++ (binding.gyp, src/);
// las copias del standalone traen nada más el .node ya compilado.
const NATIVE_SOURCE = path.join(
  ROOT,
  "node_modules/@prisma/adapter-better-sqlite3/node_modules/better-sqlite3/build/Release",
  NATIVE_MODULE,
)
// Fuera de build/Release: electron-rebuild -f borra ese directorio entero y se
// llevaría puesto el respaldo.
const NATIVE_BACKUP = path.join(BUILD_DIR, `${NATIVE_MODULE}.nodeabi`)

function run(cmd, args, env = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`)
  execFileSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  })
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
}

// El standalone de Next deja symlinks con rutas absolutas de esta máquina en
// .next/node_modules/. Copiados tal cual quedan colgados en cualquier otra Mac
// y codesign --strict rechaza el bundle. La opción `dereference` de cpSync no
// alcanza para estos symlinks anidados, así que se reemplazan a mano por el
// contenido real.
function materializeSymlinks(dir) {
  let count = 0
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(full)
        fs.rmSync(full)
        fs.cpSync(target, full, { recursive: true })
        count++
      } else if (entry.isDirectory()) {
        walk(full)
      }
    }
  }
  walk(dir)
  console.log(`  ${count} symlink(s) reemplazados por su contenido`)
}

function findFiles(dir, name, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findFiles(full, name, acc)
    else if (entry.name === name) acc.push(full)
  }
  return acc
}

// La recompilación deja el node_modules de la raíz con el ABI de Electron, lo
// que rompe `npm run dev`, `npm test` y `npm run seed`. Se restaura al salir
// pase lo que pase: si el build aborta a mitad, el entorno queda igualmente sano.
function restoreNodeAbi() {
  if (!fs.existsSync(NATIVE_BACKUP)) return
  fs.copyFileSync(NATIVE_BACKUP, NATIVE_SOURCE)
  fs.rmSync(NATIVE_BACKUP)
  console.log("\nABI de Node restaurado en node_modules.")
}
process.on("exit", restoreNodeAbi)

// Se valida antes de arrancar: descubrir una ruta mal escrita recién después de
// compilar Next costaría varios minutos.
const SEED_FROM = process.env.SEED_FROM
  ? path.resolve(ROOT, process.env.SEED_FROM)
  : null
if (SEED_FROM && !fs.existsSync(SEED_FROM)) {
  console.error(`SEED_FROM apunta a una base que no existe: ${SEED_FROM}`)
  process.exit(1)
}

// Un build anterior pudo morir de una forma que impidió restaurar (SIGKILL, corte
// de luz). Si quedó un respaldo, se recupera antes de empezar.
if (fs.existsSync(NATIVE_BACKUP)) {
  console.log("Respaldo de un build previo detectado; restaurando ABI de Node.")
  restoreNodeAbi()
}

function step(label, fn) {
  console.log(`\n=== ${label} ===`)
  fn()
}

step("Limpiando artefactos previos", () => {
  rmrf(RESOURCES_DIR)
  rmrf(SEED_DB_PATH)
  fs.mkdirSync(BUILD_DIR, { recursive: true })
})

step("Generando cliente de Prisma", () => {
  run("npx", ["prisma", "generate"])
})

step("Compilando Next.js (standalone)", () => {
  run("npx", ["next", "build"])
})

step("Creando base SQLite de plantilla", () => {
  const dbUrl = `file:${SEED_DB_PATH}`

  // Sin SEED_FROM la plantilla sale del seed de siempre (datos de prueba). Con
  // SEED_FROM la app se instala con los datos reales de esa base: es lo que
  // recibe quien abra el instalador por primera vez.
  if (!SEED_FROM) {
    run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: dbUrl })
    run("npx", ["tsx", "prisma/seed.ts"], { DATABASE_URL: dbUrl })
    return
  }

  console.log(`  Plantilla tomada de ${path.relative(ROOT, SEED_FROM)}`)
  // .backup en lugar de copiar el archivo: produce una copia consistente aun si
  // la app está abierta escribiendo sobre esa base.
  run("sqlite3", [SEED_FROM, `.backup '${SEED_DB_PATH}'`])
  // La base de origen puede venir de un schema anterior al actual.
  run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: dbUrl })
})

step("Copiando el servidor standalone + assets estáticos", () => {
  copyDir(path.join(ROOT, ".next", "standalone"), APP_DIR)
  copyDir(path.join(ROOT, ".next", "static"), path.join(APP_DIR, ".next", "static"))
  copyDir(path.join(ROOT, "public"), path.join(APP_DIR, "public"))
  // El trazado de Next arrastra backups/ (respaldos reales de la base) hacia
  // standalone. La app usa BACKUP_DIR en userData, así que acá sobran y no
  // deben viajar dentro del instalador.
  rmrf(path.join(APP_DIR, "backups"))
  materializeSymlinks(APP_DIR)
})

step("Recompilando better-sqlite3 para el ABI de Electron", () => {
  // electron-builder informa "installing native dependencies" pero baja el
  // prebuild de Node (NODE_MODULE_VERSION 147). Electron usa otro ABI (148) y
  // la app muere con ERR_DLOPEN_FAILED, así que hay que compilar desde fuente.
  const electronVersion = require(path.join(ROOT, "node_modules/electron/package.json")).version
  fs.copyFileSync(NATIVE_SOURCE, NATIVE_BACKUP)
  run("npx", ["electron-rebuild", "-f", "-v", electronVersion, "-o", "better-sqlite3", "--arch", "arm64"])
  for (const target of findFiles(APP_DIR, NATIVE_MODULE)) {
    fs.copyFileSync(NATIVE_SOURCE, target)
    console.log(`  actualizado ${path.relative(ROOT, target)}`)
  }
})

step("Copiando la base de plantilla", () => {
  fs.mkdirSync(DB_TEMPLATE_DIR, { recursive: true })
  fs.copyFileSync(SEED_DB_PATH, path.join(DB_TEMPLATE_DIR, "seed.db"))
})

step("Generando AUTH_SECRET embebido", () => {
  const secret = crypto.randomBytes(32).toString("base64")
  const content = `module.exports = { AUTH_SECRET: ${JSON.stringify(secret)} }\n`
  fs.writeFileSync(path.join(ROOT, "electron", "generated-config.js"), content)
})

step("Generando el ícono .icns", () => {
  const iconset = path.join(BUILD_DIR, "icon.iconset")
  rmrf(iconset)
  fs.mkdirSync(iconset, { recursive: true })
  const source = path.join(ROOT, "public", "apple-icon.png")
  const sizes = [16, 32, 128, 256, 512]
  for (const size of sizes) {
    run("sips", ["-z", String(size), String(size), source, "--out", path.join(iconset, `icon_${size}x${size}.png`)])
    run("sips", ["-z", String(size * 2), String(size * 2), source, "--out", path.join(iconset, `icon_${size}x${size}@2x.png`)])
  }
  run("iconutil", ["-c", "icns", iconset, "-o", path.join(BUILD_DIR, "icon.icns")])
  rmrf(iconset)
})

step("Empaquetando con electron-builder", () => {
  run("npx", ["electron-builder", "--mac"])
})

console.log("\nListo. El instalador quedó en dist/.")
