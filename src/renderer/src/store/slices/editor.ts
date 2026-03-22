import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { GitStatusEntry } from '../../../../shared/types'

export interface OpenFile {
  id: string // use filePath as unique key
  filePath: string // absolute path
  relativePath: string // relative to worktree root
  worktreeId: string
  language: string
  isDirty: boolean
  mode: 'edit' | 'diff'
  diffStaged?: boolean
}

export type RightSidebarTab = 'explorer' | 'source-control'

export interface EditorSlice {
  // Right sidebar
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  rightSidebarTab: RightSidebarTab
  toggleRightSidebar: () => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  setRightSidebarTab: (tab: RightSidebarTab) => void

  // File explorer state
  expandedDirs: Record<string, Set<string>> // worktreeId -> set of expanded dir paths
  toggleDir: (worktreeId: string, dirPath: string) => void

  // Open files / editor tabs
  openFiles: OpenFile[]
  activeFileId: string | null
  activeTabType: 'terminal' | 'editor'
  setActiveTabType: (type: 'terminal' | 'editor') => void
  openFile: (file: Omit<OpenFile, 'id' | 'isDirty'>) => void
  closeFile: (fileId: string) => void
  closeAllFiles: () => void
  setActiveFile: (fileId: string) => void
  markFileDirty: (fileId: string, dirty: boolean) => void
  openDiff: (
    worktreeId: string,
    filePath: string,
    relativePath: string,
    language: string,
    staged: boolean
  ) => void
  openAllDiffs: (worktreeId: string, worktreePath: string) => void

  // Git status cache
  gitStatusByWorktree: Record<string, GitStatusEntry[]>
  setGitStatus: (worktreeId: string, entries: GitStatusEntry[]) => void
}

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = (set) => ({
  // Right sidebar
  rightSidebarOpen: false,
  rightSidebarWidth: 280,
  rightSidebarTab: 'explorer',
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),
  setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),

  // File explorer
  expandedDirs: {},
  toggleDir: (worktreeId, dirPath) =>
    set((s) => {
      const current = s.expandedDirs[worktreeId] ?? new Set<string>()
      const next = new Set(current)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return { expandedDirs: { ...s.expandedDirs, [worktreeId]: next } }
    }),

  // Open files
  openFiles: [],
  activeFileId: null,
  activeTabType: 'terminal',
  setActiveTabType: (type) => set({ activeTabType: type }),

  openFile: (file) =>
    set((s) => {
      const id = file.filePath
      const existing = s.openFiles.find((f) => f.id === id)
      if (existing) {
        // If it's already open, just activate it (and update mode if needed)
        if (existing.mode === file.mode && existing.diffStaged === file.diffStaged) {
          return { activeFileId: id, activeTabType: 'editor' }
        }
        // Update the existing file entry
        return {
          openFiles: s.openFiles.map((f) =>
            f.id === id ? { ...f, mode: file.mode, diffStaged: file.diffStaged } : f
          ),
          activeFileId: id,
          activeTabType: 'editor'
        }
      }
      return {
        openFiles: [...s.openFiles, { ...file, id, isDirty: false }],
        activeFileId: id,
        activeTabType: 'editor'
      }
    }),

  closeFile: (fileId) =>
    set((s) => {
      const idx = s.openFiles.findIndex((f) => f.id === fileId)
      const newFiles = s.openFiles.filter((f) => f.id !== fileId)
      let newActiveId = s.activeFileId
      if (s.activeFileId === fileId) {
        // Activate adjacent tab
        if (newFiles.length === 0) {
          newActiveId = null
        } else if (idx >= newFiles.length) {
          newActiveId = newFiles[newFiles.length - 1].id
        } else {
          newActiveId = newFiles[idx].id
        }
      }
      // When last editor file is closed, switch back to terminal
      const newActiveTabType = newFiles.length === 0 ? 'terminal' : s.activeTabType
      return { openFiles: newFiles, activeFileId: newActiveId, activeTabType: newActiveTabType }
    }),

  closeAllFiles: () => set({ openFiles: [], activeFileId: null, activeTabType: 'terminal' }),

  setActiveFile: (fileId) => set({ activeFileId: fileId }),

  markFileDirty: (fileId, dirty) =>
    set((s) => ({
      openFiles: s.openFiles.map((f) => (f.id === fileId ? { ...f, isDirty: dirty } : f))
    })),

  openDiff: (worktreeId, filePath, relativePath, language, staged) =>
    set((s) => {
      // Use a unique ID that includes staging state to allow both staged and unstaged diffs
      const id = `${filePath}${staged ? '::staged' : ''}`
      const existing = s.openFiles.find((f) => f.id === id)
      if (existing) {
        return { activeFileId: id, activeTabType: 'editor' }
      }
      const newFile: OpenFile = {
        id,
        filePath,
        relativePath,
        worktreeId,
        language,
        isDirty: false,
        mode: 'diff',
        diffStaged: staged
      }
      return {
        openFiles: [...s.openFiles, newFile],
        activeFileId: id,
        activeTabType: 'editor'
      }
    }),

  openAllDiffs: (worktreeId, worktreePath) =>
    set((s) => {
      const id = `${worktreeId}::all-diffs`
      const existing = s.openFiles.find((f) => f.id === id)
      if (existing) {
        return { activeFileId: id, activeTabType: 'editor' }
      }
      const newFile: OpenFile = {
        id,
        filePath: worktreePath,
        relativePath: 'All Changes',
        worktreeId,
        language: 'plaintext',
        isDirty: false,
        mode: 'diff',
        diffStaged: undefined
      }
      return {
        openFiles: [...s.openFiles, newFile],
        activeFileId: id,
        activeTabType: 'editor'
      }
    }),

  // Git status
  gitStatusByWorktree: {},
  setGitStatus: (worktreeId, entries) =>
    set((s) => ({
      gitStatusByWorktree: { ...s.gitStatusByWorktree, [worktreeId]: entries }
    }))
})
