import { Menu, app, dialog, BrowserWindow, shell } from 'electron'
import { spawn } from 'child_process'
import { is } from '@electron-toolkit/utils'
import { UpdateService } from './services/update-service'

export function buildAppMenu(mainWindow: BrowserWindow, updateService: UpdateService): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        {
          label: 'Check for Updates…',
          click: async (): Promise<void> => {
            const update = await updateService.checkForUpdates(true)
            if (update) {
              mainWindow.webContents.send('update:available', update)
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No Updates Available',
                message: `You're on the latest version (v${app.getVersion()}).`
              })
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Workspace…',
          accelerator: 'CmdOrCtrl+O',
          click: (): void => {
            mainWindow.webContents.send('menu:open-workspace')
          }
        },
        {
          label: 'Open Workspace in New Window…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async (): Promise<void> => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory', 'createDirectory']
            })
            const selectedPath = result.filePaths[0]
            if (!selectedPath) return

            if (is.dev) {
              // In development, spawn a new Electron process with the project root arg
              const electronPath = process.execPath
              const appPath = process.argv[1]
              spawn(electronPath, [appPath, '--project-root', selectedPath], {
                detached: true,
                stdio: 'ignore',
                env: { ...process.env }
              }).unref()
            } else {
              // In production, use 'open -n' to launch a new instance of the bundled app
              const appBundlePath = app.getPath('exe').replace(/\/Contents\/.*$/, '')
              spawn('open', ['-na', appBundlePath, '--args', '--project-root', selectedPath], {
                detached: true,
                stdio: 'ignore'
              }).unref()
            }
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Run Onboarding Wizard…',
          click: (): void => {
            mainWindow.webContents.send('menu:run-onboarding')
          }
        },
        { type: 'separator' },
        {
          label: 'Install CLI',
          click: (): void => {
            mainWindow.webContents.send('menu:install-cli')
          }
        },
        { type: 'separator' },
        {
          label: 'Familiar GitHub',
          click: (): void => {
            shell.openExternal('https://github.com/familiar-sh/familiar')
          }
        }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
