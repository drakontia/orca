// ─── Repo ────────────────────────────────────────────────────────────
export interface Repo {
  id: string
  path: string
  displayName: string
  badgeColor: string
  addedAt: number
}

// ─── Worktree (git-level) ────────────────────────────────────────────
export interface GitWorktreeInfo {
  path: string
  head: string
  branch: string
  isBare: boolean
}

// ─── Worktree (app-level, enriched) ──────────────────────────────────
export interface Worktree extends GitWorktreeInfo {
  id: string // `${repoId}::${path}`
  repoId: string
  displayName: string
  comment: string
  linkedIssue: number | null
  linkedPR: number | null
  isArchived: boolean
  isUnread: boolean
  sortOrder: number
}

// ─── Worktree metadata (persisted user-authored fields only) ─────────
export interface WorktreeMeta {
  displayName: string
  comment: string
  linkedIssue: number | null
  linkedPR: number | null
  isArchived: boolean
  isUnread: boolean
  sortOrder: number
}

// ─── Terminal Tab ────────────────────────────────────────────────────
export interface TerminalTab {
  id: string
  ptyId: string | null
  worktreeId: string
  title: string
  customTitle: string | null
  color: string | null
  sortOrder: number
  createdAt: number
}

// ─── GitHub ──────────────────────────────────────────────────────────
export type PRState = 'open' | 'closed' | 'merged' | 'draft'
export type IssueState = 'open' | 'closed'
export type CheckStatus = 'pending' | 'success' | 'failure' | 'neutral'

export interface PRInfo {
  number: number
  title: string
  state: PRState
  url: string
  checksStatus: CheckStatus
  updatedAt: string
}

export interface IssueInfo {
  number: number
  title: string
  state: IssueState
  url: string
  labels: string[]
}

// ─── Hooks (orca.yaml) ──────────────────────────────────────────────
export interface OrcaHooks {
  scripts: {
    setup?: string // Runs after worktree is created
    archive?: string // Runs before worktree is archived
  }
}

// ─── Settings ────────────────────────────────────────────────────────
export interface GlobalSettings {
  workspaceDir: string
  nestWorkspaces: boolean
  branchPrefix: 'git-username' | 'custom' | 'none'
  branchPrefixCustom: string
  theme: 'system' | 'dark' | 'light'
  terminalFontSize: number
  terminalFontFamily: string
}

// ─── Persistence shape ──────────────────────────────────────────────
export interface PersistedState {
  schemaVersion: number
  repos: Repo[]
  worktreeMeta: Record<string, WorktreeMeta>
  settings: GlobalSettings
  ui: {
    lastActiveRepoId: string | null
    lastActiveWorktreeId: string | null
    sidebarWidth: number
  }
  githubCache: {
    pr: Record<string, { data: PRInfo | null; fetchedAt: number }>
    issue: Record<string, { data: IssueInfo | null; fetchedAt: number }>
  }
}
