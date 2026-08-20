const { app, BrowserWindow } = require("electron")

const DEV_URL = "http://localhost:3000"

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadURL(DEV_URL)
  win.webContents.openDevTools()
})

app.on("window-all-closed", () => {
  app.quit()
})
