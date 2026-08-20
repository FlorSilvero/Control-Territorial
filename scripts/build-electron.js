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

step("Creando base SQLite de plantilla (migrada + sembrada)", () => {
  const dbUrl = `file:${SEED_DB_PATH}`
  run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: dbUrl })
  run("npx", ["tsx", "prisma/seed.ts"], { DATABASE_URL: dbUrl })
})

step("Copiando el servidor standalone + assets estáticos", () => {
  copyDir(path.join(ROOT, ".next", "standalone"), APP_DIR)
  copyDir(path.join(ROOT, ".next", "static"), path.join(APP_DIR, ".next", "static"))
  copyDir(path.join(ROOT, "public"), path.join(APP_DIR, "public"))
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
