import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { Repo } from '../../../../shared/types'

export interface RepoSlice {
  repos: Repo[]
  activeRepoId: string | null
  fetchRepos: () => Promise<void>
  addRepo: () => Promise<Repo | null>
  removeRepo: (repoId: string) => Promise<void>
  updateRepo: (
    repoId: string,
    updates: Partial<Pick<Repo, 'displayName' | 'badgeColor'>>
  ) => Promise<void>
  setActiveRepo: (repoId: string | null) => void
}

export const createRepoSlice: StateCreator<AppState, [], [], RepoSlice> = (set, get) => ({
  repos: [],
  activeRepoId: null,

  fetchRepos: async () => {
    try {
      const repos = await window.api.repos.list()
      set({ repos })
    } catch (err) {
      console.error('Failed to fetch repos:', err)
    }
  },

  addRepo: async () => {
    try {
      const path = await window.api.repos.pickFolder()
      if (!path) return null
      const repo = await window.api.repos.add({ path })
      set((s) => ({ repos: [...s.repos, repo] }))
      return repo
    } catch (err) {
      console.error('Failed to add repo:', err)
      return null
    }
  },

  removeRepo: async (repoId) => {
    try {
      await window.api.repos.remove({ repoId })

      // Kill PTYs for all worktrees belonging to this repo
      const worktreeIds = (get().worktreesByRepo[repoId] ?? []).map((w) => w.id)
      const killedTabIds = new Set<string>()
      for (const wId of worktreeIds) {
        const tabs = get().tabsByWorktree[wId] ?? []
        for (const tab of tabs) {
          killedTabIds.add(tab.id)
          if (tab.ptyId) window.api.pty.kill(tab.ptyId)
        }
      }

      set((s) => {
        const nextWorktrees = { ...s.worktreesByRepo }
        delete nextWorktrees[repoId]
        const nextTabs = { ...s.tabsByWorktree }
        for (const wId of worktreeIds) {
          delete nextTabs[wId]
        }
        return {
          repos: s.repos.filter((r) => r.id !== repoId),
          activeRepoId: s.activeRepoId === repoId ? null : s.activeRepoId,
          worktreesByRepo: nextWorktrees,
          tabsByWorktree: nextTabs,
          activeTabId: s.activeTabId && killedTabIds.has(s.activeTabId) ? null : s.activeTabId
        }
      })
    } catch (err) {
      console.error('Failed to remove repo:', err)
    }
  },

  updateRepo: async (repoId, updates) => {
    try {
      await window.api.repos.update({ repoId, updates })
      set((s) => ({
        repos: s.repos.map((r) => (r.id === repoId ? { ...r, ...updates } : r))
      }))
    } catch (err) {
      console.error('Failed to update repo:', err)
    }
  },

  setActiveRepo: (repoId) => set({ activeRepoId: repoId })
})
