import { ipcMain, shell } from 'electron'

export function registerShellHandlers(): void {
  ipcMain.handle('shell:openPath', (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return
    }
    return shell.openExternal(url)
  })
}
