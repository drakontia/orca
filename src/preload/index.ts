import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  pty: {
    spawn: (opts: { cols: number; rows: number; cwd?: string }): Promise<{ id: string }> =>
      ipcRenderer.invoke('pty:spawn', opts),

    write: (id: string, data: string): void => {
      ipcRenderer.send('pty:write', { id, data })
    },

    resize: (id: string, cols: number, rows: number): void => {
      ipcRenderer.invoke('pty:resize', { id, cols, rows })
    },

    kill: (id: string): Promise<void> => ipcRenderer.invoke('pty:kill', { id }),

    onData: (callback: (data: { id: string; data: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) =>
        callback(data)
      ipcRenderer.on('pty:data', listener)
      return () => ipcRenderer.removeListener('pty:data', listener)
    },

    onExit: (callback: (data: { id: string; code: number }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { id: string; code: number }) =>
        callback(data)
      ipcRenderer.on('pty:exit', listener)
      return () => ipcRenderer.removeListener('pty:exit', listener)
    }
  },

  worktrees: {
    list: (
      cwd: string
    ): Promise<Array<{ path: string; head: string; branch: string; isBare: boolean }>> =>
      ipcRenderer.invoke('worktrees:list', { cwd }),

    getCurrent: (): Promise<
      Array<{ path: string; head: string; branch: string; isBare: boolean }>
    > => ipcRenderer.invoke('worktrees:get-current')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
