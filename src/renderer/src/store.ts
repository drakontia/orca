import { create } from 'zustand'

export interface Worktree {
  path: string
  head: string
  branch: string
  isBare: boolean
}

export interface AppState {
  sidebarOpen: boolean
  toggleSidebar: () => void

  worktrees: Worktree[]
  activeWorktree: string | null
  setActiveWorktree: (path: string) => void
  fetchWorktrees: () => Promise<void>

  showTerminal: boolean
  setShowTerminal: (show: boolean) => void

  terminalTitle: string
  setTerminalTitle: (title: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  worktrees: [],
  activeWorktree: null,
  setActiveWorktree: (path) => set({ activeWorktree: path }),
  fetchWorktrees: async () => {
    try {
      const worktrees = await window.api.worktrees.getCurrent()
      set({ worktrees })
    } catch (err) {
      console.error('Failed to fetch worktrees:', err)
    }
  },

  showTerminal: true,
  setShowTerminal: (show) => set({ showTerminal: show }),

  terminalTitle: '',
  setTerminalTitle: (title) => set({ terminalTitle: title })
}))
