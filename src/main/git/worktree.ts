import { execFileSync } from 'child_process'
import type { GitWorktreeInfo } from '../../shared/types'

/**
 * Parse the porcelain output of `git worktree list --porcelain`.
 */
export function parseWorktreeList(output: string): GitWorktreeInfo[] {
  const worktrees: GitWorktreeInfo[] = []
  const blocks = output.trim().split('\n\n')

  for (const block of blocks) {
    if (!block.trim()) continue

    const lines = block.trim().split('\n')
    let path = ''
    let head = ''
    let branch = ''
    let isBare = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length)
      } else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        branch = line.slice('branch '.length)
      } else if (line === 'bare') {
        isBare = true
      }
    }

    if (path) {
      worktrees.push({ path, head, branch, isBare })
    }
  }

  return worktrees
}

/**
 * List all worktrees for a git repo at the given path.
 */
export function listWorktrees(repoPath: string): GitWorktreeInfo[] {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return parseWorktreeList(output)
  } catch {
    return []
  }
}

/**
 * Create a new worktree.
 * @param repoPath - Path to the main repo (or bare repo)
 * @param worktreePath - Absolute path where the worktree will be created
 * @param branch - Branch name for the new worktree
 * @param baseBranch - Optional base branch to create from (defaults to HEAD)
 */
export function addWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch?: string
): void {
  const args = ['worktree', 'add', '-b', branch, worktreePath]
  if (baseBranch) args.push(baseBranch)
  execFileSync('git', args, {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
}

/**
 * Remove a worktree.
 */
export function removeWorktree(repoPath: string, worktreePath: string, force = false): void {
  const args = ['worktree', 'remove', worktreePath]
  if (force) args.push('--force')
  execFileSync('git', args, {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
}
