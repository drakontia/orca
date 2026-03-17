import React, { useMemo } from 'react'
import { useAppStore } from '@/store'
import WorktreeCard from './WorktreeCard'
import type { Worktree, Repo } from '../../../../shared/types'

function branchName(branch: string): string {
  return branch.replace(/^refs\/heads\//, '')
}

const WorktreeList = React.memo(function WorktreeList() {
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const repos = useAppStore((s) => s.repos)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const groupBy = useAppStore((s) => s.groupBy)
  const sortBy = useAppStore((s) => s.sortBy)
  const showActiveOnly = useAppStore((s) => s.showActiveOnly)
  const filterRepoId = useAppStore((s) => s.filterRepoId)
  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const prCache = useAppStore((s) => s.prCache)

  const repoMap = useMemo(() => {
    const m = new Map<string, Repo>()
    for (const r of repos) m.set(r.id, r)
    return m
  }, [repos])

  // Flatten, filter, sort
  const worktrees = useMemo(() => {
    let all: Worktree[] = Object.values(worktreesByRepo).flat()

    // Filter archived
    all = all.filter((w) => !w.isArchived)

    // Filter by repo
    if (filterRepoId) {
      all = all.filter((w) => w.repoId === filterRepoId)
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      all = all.filter(
        (w) =>
          w.displayName.toLowerCase().includes(q) ||
          branchName(w.branch).toLowerCase().includes(q) ||
          (repoMap.get(w.repoId)?.displayName ?? '').toLowerCase().includes(q)
      )
    }

    // Filter active only
    if (showActiveOnly) {
      all = all.filter((w) => {
        const tabs = tabsByWorktree[w.id] ?? []
        return tabs.some((t) => t.ptyId)
      })
    }

    // Sort
    all.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName)
        case 'recent':
          return b.sortOrder - a.sortOrder
        case 'repo': {
          const ra = repoMap.get(a.repoId)?.displayName ?? ''
          const rb = repoMap.get(b.repoId)?.displayName ?? ''
          const cmp = ra.localeCompare(rb)
          return cmp !== 0 ? cmp : a.displayName.localeCompare(b.displayName)
        }
        default:
          return 0
      }
    })

    return all
  }, [worktreesByRepo, filterRepoId, searchQuery, showActiveOnly, sortBy, repoMap, tabsByWorktree])

  // Group
  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return [{ label: null, items: worktrees }]
    }

    if (groupBy === 'repo') {
      const map = new Map<string, Worktree[]>()
      for (const w of worktrees) {
        const label = repoMap.get(w.repoId)?.displayName ?? 'Unknown'
        if (!map.has(label)) map.set(label, [])
        map.get(label)!.push(w)
      }
      return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
    }

    if (groupBy === 'pr-status') {
      const buckets = new Map<string, Worktree[]>()
      for (const w of worktrees) {
        const repo = repoMap.get(w.repoId)
        const branch = branchName(w.branch)
        const cacheKey = repo ? `${repo.path}::${branch}` : ''
        const prEntry = cacheKey ? prCache[cacheKey] : undefined
        const pr = prEntry !== undefined ? prEntry.data : undefined
        const label = pr ? pr.state.charAt(0).toUpperCase() + pr.state.slice(1) : 'No PR'
        if (!buckets.has(label)) buckets.set(label, [])
        buckets.get(label)!.push(w)
      }
      return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }))
    }

    return [{ label: null, items: worktrees }]
  }, [groupBy, worktrees, repoMap, prCache])

  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set())

  const toggleGroup = React.useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  if (worktrees.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">
        No worktrees found
      </div>
    )
  }

  return (
    <div className="px-1 space-y-0.5">
      {groups.map((group) => {
        const key = group.label ?? '__all__'
        const isCollapsed = group.label ? collapsedGroups.has(group.label) : false

        return (
          <div key={key}>
            {group.label && (
              <button
                className="flex items-center gap-1 px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full text-left hover:text-foreground transition-colors"
                onClick={() => toggleGroup(group.label!)}
              >
                <span
                  className="inline-block transition-transform text-[8px]"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                >
                  &#9660;
                </span>
                {group.label}
                <span className="ml-auto text-[9px] font-normal tabular-nums">
                  {group.items.length}
                </span>
              </button>
            )}
            {!isCollapsed &&
              group.items.map((wt) => (
                <WorktreeCard
                  key={wt.id}
                  worktree={wt}
                  repo={repoMap.get(wt.repoId)}
                  isActive={activeWorktreeId === wt.id}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
})

export default WorktreeList
