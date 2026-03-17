import { app, shell, BrowserWindow, ipcMain, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { execSync } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import devIcon from '../../resources/icon-dev.png?asset'
import * as pty from 'node-pty'

// Enable WebGPU in Electron
app.commandLine.appendSwitch('enable-features', 'Vulkan,UseSkiaGraphite')
app.commandLine.appendSwitch('enable-unsafe-webgpu')

// ---------------------------------------------------------------------------
// PTY instance tracking
// ---------------------------------------------------------------------------
let ptyCounter = 0
const ptyProcesses = new Map<string, pty.IPty>()

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
// Worktree helpers
// ---------------------------------------------------------------------------
interface WorktreeInfo {
  path: string
  head: string
  branch: string
  isBare: boolean
}

function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = []
  const blocks = output.trim().split('\n\n')

  for (const block of blocks) {
    if (!block.trim()) continue

    const lines = block.trim().split('\n')
    let path = ''
    let head = ''
    let branch = ''
    let isBare = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length)
      } else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        branch = line.slice('branch '.length)
      } else if (line === 'bare') {
        isBare = true
      }
    }

    if (path) {
      worktrees.push({ path, head, branch, isBare })
    }
  }

  return worktrees
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  if (process.platform === 'darwin') {
    const dockIcon = nativeImage.createFromPath(is.dev ? devIcon : icon)
    app.dock.setIcon(dockIcon)
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

  const mainWindow = createWindow()

  // -------------------------------------------------------------------------
  // PTY IPC handlers
  // -------------------------------------------------------------------------
  ipcMain.handle('pty:spawn', (_event, args: { cols: number; rows: number; cwd?: string }) => {
    const id = String(++ptyCounter)
    const shell = process.env.SHELL || '/bin/zsh'

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: args.cols,
      rows: args.rows,
      cwd: args.cwd || process.env.HOME || '/',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      } as Record<string, string>
    })

    ptyProcesses.set(id, ptyProcess)

    ptyProcess.onData((data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:data', { id, data })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      ptyProcesses.delete(id)
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', { id, code: exitCode })
      }
    })

    return { id }
  })

  ipcMain.on('pty:write', (_event, args: { id: string; data: string }) => {
    const proc = ptyProcesses.get(args.id)
    if (proc) {
      proc.write(args.data)
    }
  })

  ipcMain.handle('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    const proc = ptyProcesses.get(args.id)
    if (proc) {
      proc.resize(args.cols, args.rows)
    }
  })

  ipcMain.handle('pty:kill', (_event, args: { id: string }) => {
    const proc = ptyProcesses.get(args.id)
    if (proc) {
      proc.kill()
      ptyProcesses.delete(args.id)
    }
  })

  // -------------------------------------------------------------------------
  // Worktree IPC handlers
  // -------------------------------------------------------------------------
  ipcMain.handle('worktrees:list', (_event, args: { cwd: string }): WorktreeInfo[] => {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: args.cwd,
        encoding: 'utf-8'
      })
      return parseWorktreeList(output)
    } catch {
      return []
    }
  })

  ipcMain.handle('worktrees:get-current', (_event): WorktreeInfo[] => {
    try {
      const repoRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf-8'
      }).trim()

      const output = execSync('git worktree list --porcelain', {
        cwd: repoRoot,
        encoding: 'utf-8'
      })
      return parseWorktreeList(output)
    } catch {
      return []
    }
  })

  // -------------------------------------------------------------------------
  // macOS re-activate
  // -------------------------------------------------------------------------
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
app.on('before-quit', () => {
  for (const [id, proc] of ptyProcesses) {
    proc.kill()
    ptyProcesses.delete(id)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
