import { execSync } from 'child_process'
import { existsSync, statSync } from 'fs'
import { join, basename } from 'path'

/**
 * Check if a path is a valid git repository (regular or bare).
 */
export function isGitRepo(path: string): boolean {
  try {
    if (!existsSync(path) || !statSync(path).isDirectory()) return false
    // .git dir or file (for worktrees) or bare repo
    if (existsSync(join(path, '.git'))) return true
    // Might be a bare repo — ask git
    const result = execSync('git rev-parse --is-inside-work-tree', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    return result === 'true'
  } catch {
    // Also check if it's a bare repo
    try {
      const result = execSync('git rev-parse --is-bare-repository', {
        cwd: path,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
      return result === 'true'
    } catch {
      return false
    }
  }
}

/**
 * Get a human-readable name for the repo from its path.
 */
export function getRepoName(path: string): string {
  const name = basename(path)
  // Strip .git suffix from bare repos
  return name.endsWith('.git') ? name.slice(0, -4) : name
}

/**
 * Get the remote origin URL, or null if not set.
 */
export function getRemoteUrl(path: string): string | null {
  try {
    return execSync('git remote get-url origin', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
  } catch {
    return null
  }
}

/**
 * Get git config user.name for the repo.
 */
export function getGitUsername(path: string): string {
  try {
    return execSync('git config user.name', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
  } catch {
    return ''
  }
}

/**
 * Detect the default branch (main or master).
 */
export function getDefaultBranch(path: string): string {
  try {
    // Check if 'main' branch exists
    execSync('git rev-parse --verify refs/heads/main', {
      cwd: path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return 'main'
  } catch {
    try {
      execSync('git rev-parse --verify refs/heads/master', {
        cwd: path,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      return 'master'
    } catch {
      return 'main'
    }
  }
}
