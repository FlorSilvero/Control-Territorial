const { execFileSync } = require("node:child_process")
const path = require("node:path")

// electron-builder omite la firma cuando no encuentra un certificado de Apple.
// En Apple Silicon un bundle sin Contents/_CodeSignature es rechazado por
// Gatekeeper, así que lo firmamos ad-hoc (gratis, no requiere cuenta de
// desarrollador). No reemplaza a la notarización: la app sigue necesitando
// el "Abrir igualmente" la primera vez en otra Mac.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  console.log(`  • firmando ad-hoc  file=${appPath}`)
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" })
  execFileSync("codesign", ["--verify", "--strict", appPath], { stdio: "inherit" })
}
