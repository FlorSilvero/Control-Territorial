const { app, BrowserWindow } = require("electron")
const { spawn } = require("node:child_process")
const path = require("node:path")
const fs = require("node:fs")
const net = require("node:net")

let serverProcess = null
let mainWindow = null
let serverPort = null
let quitting = false

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on("error", reject)
  })
}

function ensureDatabase() {
  const dbPath = path.join(app.getPath("userData"), "app.db")
  if (!fs.existsSync(dbPath)) {
    const templatePath = path.join(process.resourcesPath, "db-template", "seed.db")
    fs.copyFileSync(templatePath, dbPath)
  }
  return dbPath
}

function backupDir() {
  return path.join(app.getPath("userData"), "backups")
}

async function runBackup() {
  if (!serverPort) return
  const { AUTH_SECRET } = require("./generated-config.js")
  try {
    const res = await fetch(`http://127.0.0.1:${serverPort}/api/backup`, {
      method: "POST",
      headers: { "x-backup-secret": AUTH_SECRET },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { filePath } = await res.json()
    console.log(`[backup] saved -> ${filePath}`)
  } catch (err) {
    console.error("[backup] failed:", err)
  }
}

function startServer() {
  return new Promise(async (resolve, reject) => {
    const port = await getFreePort()
    const dbPath = ensureDatabase()
    const appDir = path.join(process.resourcesPath, "app")
    const serverEntry = path.join(appDir, "server.js")
    const { AUTH_SECRET } = require("./generated-config.js")

    serverProcess = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        AUTH_TRUST_HOST: "true",
        DATABASE_URL: `file:${dbPath}`,
        BACKUP_DIR: backupDir(),
        AUTH_SECRET,
      },
      cwd: appDir,
      stdio: ["ignore", "pipe", "pipe"],
    })

    const timeout = setTimeout(() => reject(new Error("El servidor tardó demasiado en arrancar")), 20000)

    serverProcess.stdout.on("data", (chunk) => {
      const text = chunk.toString()
      if (/ready/i.test(text)) {
        clearTimeout(timeout)
        resolve(port)
      }
    })
    serverProcess.stderr.on("data", (chunk) => {
      console.error(chunk.toString())
    })
    serverProcess.on("error", reject)
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout)
        reject(new Error(`El servidor terminó con código ${code}`))
      }
    })
  })
}

async function createWindow() {
  const port = await startServer()
  serverPort = port
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  await mainWindow.loadURL(`http://127.0.0.1:${port}`)
  runBackup()
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error(err)
    app.quit()
  })
})

app.on("window-all-closed", () => {
  app.quit()
})

app.on("before-quit", (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()

  runBackup().finally(() => {
    if (serverProcess) {
      serverProcess.kill()
      serverProcess = null
    }
    app.quit()
  })
})
