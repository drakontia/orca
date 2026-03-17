import { app, shell, BrowserWindow, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import devIcon from '../../resources/icon-dev.png?asset'

import { Store } from './persistence'
import { registerRepoHandlers } from './ipc/repos'
import { registerWorktreeHandlers } from './ipc/worktrees'
import { registerPtyHandlers, killAllPty } from './ipc/pty'
import { registerGitHubHandlers } from './ipc/github'
import { registerSettingsHandlers } from './ipc/settings'
import { registerShellHandlers } from './ipc/shell'

let mainWindow: BrowserWindow | null = null
let store: Store | null = null

// Enable WebGPU in Electron
app.commandLine.appendSwitch('enable-features', 'Vulkan,UseSkiaGraphite')
app.commandLine.appendSwitch('enable-unsafe-webgpu')

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 12 } } : {}),
    icon: is.dev ? devIcon : icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.setName('Orca')

  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(is.dev ? devIcon : icon)
    app.dock?.setIcon(dockIcon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Override default menu to prevent Cmd+W from closing the window.
  // The renderer handles Cmd+W to close terminal panes instead.
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
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
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
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
      submenu: [{ role: 'minimize' }, { role: 'zoom' }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  // Initialize persistence
  store = new Store()

  // Create window
  mainWindow = createWindow()

  // Register all IPC handlers
  registerRepoHandlers(mainWindow, store)
  registerWorktreeHandlers(mainWindow, store)
  registerPtyHandlers(mainWindow)
  registerGitHubHandlers()
  registerSettingsHandlers(store)
  registerShellHandlers()

  // macOS re-activate
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      registerPtyHandlers(mainWindow)
    }
  })
})

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
app.on('before-quit', () => {
  killAllPty()
  store?.flush()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
