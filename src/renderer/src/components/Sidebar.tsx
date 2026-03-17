import { useEffect } from 'react'
import { useAppStore } from '../store'

function branchDisplayName(branch: string): string {
  return branch.replace(/^refs\/heads\//, '')
}

function pathBasename(p: string): string {
  return p.split('/').pop() || p
}

export default function Sidebar(): React.JSX.Element {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const worktrees = useAppStore((s) => s.worktrees)
  const activeWorktree = useAppStore((s) => s.activeWorktree)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const fetchWorktrees = useAppStore((s) => s.fetchWorktrees)

  useEffect(() => {
    fetchWorktrees()
  }, [fetchWorktrees])

  return (
    <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-header">Worktrees</div>
      <ul className="worktree-list">
        {worktrees.map((wt) => (
          <li
            key={wt.path}
            className={`worktree-item ${activeWorktree === wt.path ? 'active' : ''}`}
            onClick={() => setActiveWorktree(wt.path)}
          >
            <span className="worktree-branch">
              {wt.isBare ? '(bare)' : branchDisplayName(wt.branch)}
            </span>
            <span className="worktree-path">{pathBasename(wt.path)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
