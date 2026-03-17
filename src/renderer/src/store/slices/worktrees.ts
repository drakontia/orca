import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { Worktree, WorktreeMeta } from '../../../../shared/types'

export interface WorktreeSlice {
  worktreesByRepo: Record<string, Worktree[]>
  activeWorktreeId: string | null
  fetchWorktrees: (repoId: string) => Promise<void>
  fetchAllWorktrees: () => Promise<void>
  createWorktree: (repoId: string, name: string, baseBranch?: string) => Promise<Worktree | null>
  removeWorktree: (worktreeId: string, force?: boolean) => Promise<void>
  updateWorktreeMeta: (worktreeId: string, updates: Partial<WorktreeMeta>) => Promise<void>
  setActiveWorktree: (worktreeId: string | null) => void
  allWorktrees: () => Worktree[]
}

export const createWorktreeSlice: StateCreator<AppState, [], [], WorktreeSlice> = (set, get) => ({
  worktreesByRepo: {},
  activeWorktreeId: null,

  fetchWorktrees: async (repoId) => {
    try {
      const worktrees = await window.api.worktrees.list({ repoId })
      set((s) => ({
        worktreesByRepo: { ...s.worktreesByRepo, [repoId]: worktrees }
      }))
    } catch (err) {
      console.error(`Failed to fetch worktrees for repo ${repoId}:`, err)
    }
  },

  fetchAllWorktrees: async () => {
    const { repos } = get()
    await Promise.all(repos.map((r) => get().fetchWorktrees(r.id)))
  },

  createWorktree: async (repoId, name, baseBranch) => {
    try {
      const worktree = await window.api.worktrees.create({ repoId, name, baseBranch })
      set((s) => ({
        worktreesByRepo: {
          ...s.worktreesByRepo,
          [repoId]: [...(s.worktreesByRepo[repoId] ?? []), worktree]
        }
      }))
      return worktree
    } catch (err) {
      console.error('Failed to create worktree:', err)
      return null
    }
  },

  removeWorktree: async (worktreeId, force) => {
    try {
      await window.api.worktrees.remove({ worktreeId, force })
      // Kill PTYs for tabs belonging to this worktree
      const tabs = get().tabsByWorktree[worktreeId] ?? []
      const tabIds = new Set(tabs.map((t) => t.id))
      for (const tab of tabs) {
        if (tab.ptyId) window.api.pty.kill(tab.ptyId)
      }

      set((s) => {
        const next = { ...s.worktreesByRepo }
        for (const repoId of Object.keys(next)) {
          next[repoId] = next[repoId].filter((w) => w.id !== worktreeId)
        }
        const nextTabs = { ...s.tabsByWorktree }
        delete nextTabs[worktreeId]
        return {
          worktreesByRepo: next,
          tabsByWorktree: nextTabs,
          activeWorktreeId: s.activeWorktreeId === worktreeId ? null : s.activeWorktreeId,
          activeTabId: s.activeTabId && tabIds.has(s.activeTabId) ? null : s.activeTabId
        }
      })
    } catch (err) {
      console.error('Failed to remove worktree:', err)
    }
  },

  updateWorktreeMeta: async (worktreeId, updates) => {
    try {
      await window.api.worktrees.updateMeta({ worktreeId, updates })
      set((s) => {
        const next = { ...s.worktreesByRepo }
        for (const repoId of Object.keys(next)) {
          next[repoId] = next[repoId].map((w) => (w.id === worktreeId ? { ...w, ...updates } : w))
        }
        return { worktreesByRepo: next }
      })
    } catch (err) {
      console.error('Failed to update worktree meta:', err)
    }
  },

  setActiveWorktree: (worktreeId) => set({ activeWorktreeId: worktreeId }),

  allWorktrees: () => Object.values(get().worktreesByRepo).flat()
})
