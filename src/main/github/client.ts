import { execFileSync } from 'child_process'
import type { PRInfo, IssueInfo, CheckStatus } from '../../shared/types'

/**
 * Get PR info for a given branch using gh CLI.
 * Returns null if gh is not installed, or no PR exists for the branch.
 */
export function getPRForBranch(repoPath: string, branch: string): PRInfo | null {
  try {
    // Strip refs/heads/ prefix if present
    const branchName = branch.replace(/^refs\/heads\//, '')
    const raw = execFileSync(
      'gh',
      ['pr', 'view', branchName, '--json', 'number,title,state,url,statusCheckRollup,updatedAt'],
      {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )
    const data = JSON.parse(raw)
    return {
      number: data.number,
      title: data.title,
      state: mapPRState(data.state),
      url: data.url,
      checksStatus: deriveCheckStatus(data.statusCheckRollup),
      updatedAt: data.updatedAt
    }
  } catch {
    return null
  }
}

/**
 * Get a single issue by number.
 */
export function getIssue(repoPath: string, issueNumber: number): IssueInfo | null {
  try {
    const raw = execFileSync(
      'gh',
      ['issue', 'view', String(issueNumber), '--json', 'number,title,state,url,labels'],
      {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )
    const data = JSON.parse(raw)
    return {
      number: data.number,
      title: data.title,
      state: data.state?.toLowerCase() === 'open' ? 'open' : 'closed',
      url: data.url,
      labels: (data.labels || []).map((l: { name: string }) => l.name)
    }
  } catch {
    return null
  }
}

/**
 * List issues for a repo.
 */
export function listIssues(repoPath: string, limit = 20): IssueInfo[] {
  try {
    const raw = execFileSync(
      'gh',
      ['issue', 'list', '--json', 'number,title,state,url,labels', '--limit', String(limit)],
      {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    )
    const data = JSON.parse(raw) as Array<{
      number: number
      title: string
      state: string
      url: string
      labels: Array<{ name: string }>
    }>
    return data.map((d) => ({
      number: d.number,
      title: d.title,
      state: d.state?.toLowerCase() === 'open' ? ('open' as const) : ('closed' as const),
      url: d.url,
      labels: (d.labels || []).map((l) => l.name)
    }))
  } catch {
    return []
  }
}

function mapPRState(state: string): PRInfo['state'] {
  const s = state?.toUpperCase()
  if (s === 'MERGED') return 'merged'
  if (s === 'CLOSED') return 'closed'
  // gh CLI returns isDraft separately, but state field is OPEN for drafts too
  return 'open'
}

function deriveCheckStatus(rollup: unknown[] | null | undefined): CheckStatus {
  if (!rollup || !Array.isArray(rollup) || rollup.length === 0) return 'pending'

  let hasFailure = false
  let hasPending = false

  for (const check of rollup as Array<{ status?: string; conclusion?: string; state?: string }>) {
    const conclusion = check.conclusion?.toUpperCase()
    const status = check.status?.toUpperCase()
    const state = check.state?.toUpperCase()

    if (
      conclusion === 'FAILURE' ||
      conclusion === 'TIMED_OUT' ||
      conclusion === 'CANCELLED' ||
      state === 'FAILURE' ||
      state === 'ERROR'
    ) {
      hasFailure = true
    } else if (
      status === 'IN_PROGRESS' ||
      status === 'QUEUED' ||
      status === 'PENDING' ||
      state === 'PENDING'
    ) {
      hasPending = true
    }
  }

  if (hasFailure) return 'failure'
  if (hasPending) return 'pending'
  return 'success'
}
