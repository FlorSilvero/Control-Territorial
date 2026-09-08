import type { MetadataRoute } from "next"

// Next.js auto-serves this at /manifest.webmanifest and links it in <head> —
// no manual <link rel="manifest"> needed. It's what browsers read when the
// user picks "Instalar app" / "Agregar a la pantalla de inicio", so the
// icons and colors here are what shows up as the installed app's icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestión Distrital",
    short_name: "Gestión Distrital",
    description:
      "Gestión de distritos, iglesias, pastores y estadísticas históricas de bautismos y miembros.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf7",
    theme_color: "#2b6547",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
