import { ElectronAPI } from '@electron-toolkit/preload'

interface WorktreeInfo {
  path: string
  head: string
  branch: string
  isBare: boolean
}

interface PtyApi {
  spawn: (opts: { cols: number; rows: number; cwd?: string }) => Promise<{ id: string }>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void
  kill: (id: string) => Promise<void>
  onData: (callback: (data: { id: string; data: string }) => void) => () => void
  onExit: (callback: (data: { id: string; code: number }) => void) => () => void
}

interface WorktreesApi {
  list: (cwd: string) => Promise<WorktreeInfo[]>
  getCurrent: () => Promise<WorktreeInfo[]>
}

interface Api {
  pty: PtyApi
  worktrees: WorktreesApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
