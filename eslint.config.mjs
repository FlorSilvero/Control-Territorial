import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"

// eslint-config-next 16 ships native flat configs, so no FlatCompat wrapper.
const config = [
  {
    // Prisma's generated client and build artifacts are not ours to lint.
    ignores: [
      "lib/generated/**",
      ".next/**",
      "electron-resources/**",
      "dist/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // The Electron main process and the packaging script run as plain Node
    // CommonJS, outside the bundler — require() is the correct call there.
    files: ["electron/**/*.js", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]

export default config
