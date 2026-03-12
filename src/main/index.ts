import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ElectronTmuxManager } from './platform/electron-tmux'
import { ElectronPtyManager } from './platform/electron-pty'
import { registerPtyHandlers } from './ipc/pty-handlers'
import { registerTmuxHandlers } from './ipc/tmux-handlers'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerNotificationHandlers } from './ipc/notification-handlers'
import { registerWindowHandlers } from './ipc/window-handlers'
import { DataService } from './services/data-service'
import { FileWatcher } from './services/file-watcher'

const tmuxManager = new ElectronTmuxManager()
const ptyManager = new ElectronPtyManager(tmuxManager)
let fileWatcher: FileWatcher | null = null

// Register custom protocol scheme for serving attachment files
// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kanban-attachment',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

// Default project root to the current working directory
const dataService = new DataService(process.cwd())
ptyManager.setDataService(dataService)

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()

    // Start file watcher after window is ready
    fileWatcher = new FileWatcher(dataService.getProjectRoot(), mainWindow)
    fileWatcher.start()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite CLI.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Register IPC handlers
  registerPtyHandlers(ptyManager, mainWindow)
  registerTmuxHandlers(tmuxManager)
  registerFileHandlers(dataService)
  registerNotificationHandlers(dataService)
  registerWindowHandlers(
    mainWindow,
    dataService,
    () => fileWatcher,
    (fw) => { fileWatcher = fw }
  )
}

app.whenReady().then(() => {
  // Set app user model id for macOS
  electronApp.setAppUserModelId('com.kanban-agent')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Handle kanban-attachment:// protocol requests by serving local files
  protocol.handle('kanban-attachment', (request) => {
    // URL format: kanban-attachment://file/<absolute-path>
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)
    return net.fetch(`file://${filePath}`)
  })

  createWindow()

  app.on('activate', () => {
    // On macOS re-create a window when the dock icon is clicked
    // and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  fileWatcher?.stop()
  fileWatcher = null
})
