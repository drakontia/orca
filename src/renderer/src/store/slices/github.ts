import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { PRInfo, IssueInfo } from '../../../../shared/types'

export interface CacheEntry<T> {
  data: T | null
  fetchedAt: number
}

const CACHE_TTL = 60_000 // 60 seconds

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return entry !== undefined && Date.now() - entry.fetchedAt < CACHE_TTL
}

export interface GitHubSlice {
  prCache: Record<string, CacheEntry<PRInfo>>
  issueCache: Record<string, CacheEntry<IssueInfo>>
  fetchPRForBranch: (repoPath: string, branch: string) => Promise<PRInfo | null>
  fetchIssue: (repoPath: string, number: number) => Promise<IssueInfo | null>
}

export const createGitHubSlice: StateCreator<AppState, [], [], GitHubSlice> = (set, get) => ({
  prCache: {},
  issueCache: {},

  fetchPRForBranch: async (repoPath, branch) => {
    const cacheKey = `${repoPath}::${branch}`
    const cached = get().prCache[cacheKey]
    if (isFresh(cached)) return cached.data

    try {
      const pr = await window.api.gh.prForBranch({ repoPath, branch })
      set((s) => ({
        prCache: { ...s.prCache, [cacheKey]: { data: pr, fetchedAt: Date.now() } }
      }))
      return pr
    } catch (err) {
      console.error('Failed to fetch PR:', err)
      set((s) => ({
        prCache: { ...s.prCache, [cacheKey]: { data: null, fetchedAt: Date.now() } }
      }))
      return null
    }
  },

  fetchIssue: async (repoPath, number) => {
    const cacheKey = `${repoPath}::${number}`
    const cached = get().issueCache[cacheKey]
    if (isFresh(cached)) return cached.data

    try {
      const issue = await window.api.gh.issue({ repoPath, number })
      set((s) => ({
        issueCache: { ...s.issueCache, [cacheKey]: { data: issue, fetchedAt: Date.now() } }
      }))
      return issue
    } catch (err) {
      console.error('Failed to fetch issue:', err)
      set((s) => ({
        issueCache: { ...s.issueCache, [cacheKey]: { data: null, fetchedAt: Date.now() } }
      }))
      return null
    }
  }
})
