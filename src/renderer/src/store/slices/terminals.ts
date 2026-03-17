import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { TerminalTab } from '../../../../shared/types'

export interface TerminalSlice {
  tabsByWorktree: Record<string, TerminalTab[]>
  activeTabId: string | null
  createTab: (worktreeId: string) => TerminalTab
  closeTab: (tabId: string) => void
  reorderTabs: (worktreeId: string, tabIds: string[]) => void
  setActiveTab: (tabId: string) => void
  updateTabTitle: (tabId: string, title: string) => void
  setTabCustomTitle: (tabId: string, title: string | null) => void
  setTabColor: (tabId: string, color: string | null) => void
  updateTabPtyId: (tabId: string, ptyId: string) => void
}

export const createTerminalSlice: StateCreator<AppState, [], [], TerminalSlice> = (set) => ({
  tabsByWorktree: {},
  activeTabId: null,

  createTab: (worktreeId) => {
    const id = globalThis.crypto.randomUUID()
    let tab!: TerminalTab
    set((s) => {
      const existing = s.tabsByWorktree[worktreeId] ?? []
      tab = {
        id,
        ptyId: null,
        worktreeId,
        title: `Terminal ${existing.length + 1}`,
        customTitle: null,
        color: null,
        sortOrder: existing.length,
        createdAt: Date.now()
      }
      return {
        tabsByWorktree: {
          ...s.tabsByWorktree,
          [worktreeId]: [...existing, tab]
        },
        activeTabId: tab.id
      }
    })
    return tab
  },

  closeTab: (tabId) => {
    set((s) => {
      const next = { ...s.tabsByWorktree }
      for (const wId of Object.keys(next)) {
        const before = next[wId]
        const after = before.filter((t) => t.id !== tabId)
        if (after.length !== before.length) {
          next[wId] = after
        }
      }
      return {
        tabsByWorktree: next,
        activeTabId: s.activeTabId === tabId ? null : s.activeTabId
      }
    })
  },

  reorderTabs: (worktreeId, tabIds) => {
    set((s) => {
      const tabs = s.tabsByWorktree[worktreeId] ?? []
      const tabMap = new Map(tabs.map((t) => [t.id, t]))
      const reordered = tabIds
        .map((id, i) => {
          const tab = tabMap.get(id)
          return tab ? { ...tab, sortOrder: i } : undefined
        })
        .filter((t): t is TerminalTab => t !== undefined)
      return {
        tabsByWorktree: { ...s.tabsByWorktree, [worktreeId]: reordered }
      }
    })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabTitle: (tabId, title) => {
    set((s) => {
      const next = { ...s.tabsByWorktree }
      for (const wId of Object.keys(next)) {
        next[wId] = next[wId].map((t) => (t.id === tabId ? { ...t, title } : t))
      }
      return { tabsByWorktree: next }
    })
  },

  setTabCustomTitle: (tabId, title) => {
    set((s) => {
      const next = { ...s.tabsByWorktree }
      for (const wId of Object.keys(next)) {
        next[wId] = next[wId].map((t) => (t.id === tabId ? { ...t, customTitle: title } : t))
      }
      return { tabsByWorktree: next }
    })
  },

  setTabColor: (tabId, color) => {
    set((s) => {
      const next = { ...s.tabsByWorktree }
      for (const wId of Object.keys(next)) {
        next[wId] = next[wId].map((t) => (t.id === tabId ? { ...t, color } : t))
      }
      return { tabsByWorktree: next }
    })
  },

  updateTabPtyId: (tabId, ptyId) => {
    set((s) => {
      const next = { ...s.tabsByWorktree }
      for (const wId of Object.keys(next)) {
        next[wId] = next[wId].map((t) => (t.id === tabId ? { ...t, ptyId } : t))
      }
      return { tabsByWorktree: next }
    })
  }
})
