import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { REPO_COLORS } from '../../../shared/constants'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { ArrowLeft, FolderOpen, Minus, Plus, Trash2 } from 'lucide-react'

function Settings(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const repos = useAppStore((s) => s.repos)
  const updateRepo = useAppStore((s) => s.updateRepo)
  const removeRepo = useAppStore((s) => s.removeRepo)

  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)
  const [repoHooksMap, setRepoHooksMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Check which repos have orca.yaml hooks
  useEffect(() => {
    let stale = false
    const checkHooks = async () => {
      const results = await Promise.all(
        repos.map(async (repo) => {
          try {
            const result = await window.api.hooks.check({ repoId: repo.id })
            return [repo.id, result.hasHooks] as const
          } catch {
            return [repo.id, false] as const
          }
        })
      )
      if (!stale) {
        setRepoHooksMap(Object.fromEntries(results))
      }
    }
    if (repos.length > 0) checkHooks()
    return () => {
      stale = true
    }
  }, [repos])

  // Apply theme immediately
  const applyTheme = useCallback((theme: 'system' | 'dark' | 'light') => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [])

  const handleBrowseWorkspace = async () => {
    const path = await window.api.repos.pickFolder()
    if (path) {
      updateSettings({ workspaceDir: path })
    }
  }

  const handleRemoveRepo = (repoId: string) => {
    if (confirmingRemove === repoId) {
      removeRepo(repoId)
      setConfirmingRemove(null)
    } else {
      setConfirmingRemove(repoId)
    }
  }

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Button variant="ghost" size="icon-sm" onClick={() => setActiveView('terminal')}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl px-8 py-6 space-y-8">
          {/* ── Workspace ────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Workspace</h2>

            {/* Workspace Directory */}
            <div className="space-y-2">
              <Label className="text-sm">Workspace Directory</Label>
              <p className="text-xs text-muted-foreground">
                Root directory where worktree folders are created.
              </p>
              <div className="flex gap-2">
                <Input
                  value={settings.workspaceDir}
                  onChange={(e) => updateSettings({ workspaceDir: e.target.value })}
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBrowseWorkspace}
                  className="gap-1.5 shrink-0"
                >
                  <FolderOpen className="size-3.5" />
                  Browse
                </Button>
              </div>
            </div>

            {/* Nest Workspaces */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Nest Workspaces</Label>
                <p className="text-xs text-muted-foreground">
                  Create worktrees inside a repo-named subfolder.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={settings.nestWorkspaces}
                onClick={() => updateSettings({ nestWorkspaces: !settings.nestWorkspaces })}
                className={`
                  relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                  border border-transparent transition-colors
                  ${settings.nestWorkspaces ? 'bg-foreground' : 'bg-muted-foreground/30'}
                `}
              >
                <span
                  className={`
                    pointer-events-none block size-3.5 rounded-full bg-background shadow-sm transition-transform
                    ${settings.nestWorkspaces ? 'translate-x-4' : 'translate-x-0.5'}
                  `}
                />
              </button>
            </div>
          </section>

          <Separator />

          {/* ── Branch Prefix ────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Branch Naming</h2>

            <div className="space-y-2">
              <Label className="text-sm">Branch Name Prefix</Label>
              <p className="text-xs text-muted-foreground">
                Prefix added to branch names when creating worktrees.
              </p>
              <div className="flex gap-1 rounded-md border p-1 w-fit">
                {(['git-username', 'custom', 'none'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => updateSettings({ branchPrefix: option })}
                    className={`
                      px-3 py-1 text-sm rounded-sm transition-colors
                      ${
                        settings.branchPrefix === option
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    {option === 'git-username'
                      ? 'Git Username'
                      : option === 'custom'
                        ? 'Custom'
                        : 'None'}
                  </button>
                ))}
              </div>
              {settings.branchPrefix === 'custom' && (
                <Input
                  value={settings.branchPrefixCustom}
                  onChange={(e) => updateSettings({ branchPrefixCustom: e.target.value })}
                  placeholder="e.g. feature/"
                  className="max-w-xs mt-2"
                />
              )}
            </div>
          </section>

          <Separator />

          {/* ── Appearance ───────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Appearance</h2>

            {/* Theme */}
            <div className="space-y-2">
              <Label className="text-sm">Theme</Label>
              <div className="flex gap-1 rounded-md border p-1 w-fit">
                {(['system', 'dark', 'light'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      updateSettings({ theme: option })
                      applyTheme(option)
                    }}
                    className={`
                      px-3 py-1 text-sm rounded-sm transition-colors capitalize
                      ${
                        settings.theme === option
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Terminal ─────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Terminal</h2>

            {/* Font Size */}
            <div className="space-y-2">
              <Label className="text-sm">Font Size</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => {
                    const next = Math.max(10, settings.terminalFontSize - 1)
                    updateSettings({ terminalFontSize: next })
                  }}
                  disabled={settings.terminalFontSize <= 10}
                >
                  <Minus className="size-3" />
                </Button>
                <Input
                  type="number"
                  min={10}
                  max={24}
                  value={settings.terminalFontSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val >= 10 && val <= 24) {
                      updateSettings({ terminalFontSize: val })
                    }
                  }}
                  className="w-16 text-center tabular-nums"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => {
                    const next = Math.min(24, settings.terminalFontSize + 1)
                    updateSettings({ terminalFontSize: next })
                  }}
                  disabled={settings.terminalFontSize >= 24}
                >
                  <Plus className="size-3" />
                </Button>
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            </div>

            {/* Font Family */}
            <div className="space-y-2">
              <Label className="text-sm">Font Family</Label>
              <Input
                value={settings.terminalFontFamily}
                onChange={(e) => updateSettings({ terminalFontFamily: e.target.value })}
                placeholder="SF Mono"
                className="max-w-xs"
              />
            </div>
          </section>

          <Separator />

          {/* ── Repos ────────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Repositories</h2>
            <p className="text-xs text-muted-foreground">
              Manage display names and badge colors for your repositories.
            </p>

            {repos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No repositories added yet.</p>
            ) : (
              <div className="space-y-3">
                {repos.map((repo) => (
                  <div key={repo.id} className="flex items-center gap-4 rounded-lg border p-3">
                    {/* Color picker */}
                    <div className="flex gap-1.5 shrink-0">
                      {REPO_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateRepo(repo.id, { badgeColor: color })}
                          className={`
                            size-5 rounded-full transition-all
                            ${
                              repo.badgeColor === color
                                ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                                : 'hover:ring-1 hover:ring-muted-foreground hover:ring-offset-1 hover:ring-offset-background'
                            }
                          `}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>

                    {/* Display name */}
                    <Input
                      value={repo.displayName}
                      onChange={(e) => updateRepo(repo.id, { displayName: e.target.value })}
                      className="flex-1 h-8 text-sm"
                    />

                    {/* Hooks indicator */}
                    {repoHooksMap[repo.id] && (
                      <span
                        className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground"
                        title="This repo has an orca.yaml with lifecycle hooks"
                      >
                        hooks
                      </span>
                    )}

                    {/* Remove */}
                    <Button
                      variant={confirmingRemove === repo.id ? 'destructive' : 'ghost'}
                      size="icon-sm"
                      onClick={() => handleRemoveRepo(repo.id)}
                      onBlur={() => setConfirmingRemove(null)}
                      title={
                        confirmingRemove === repo.id
                          ? 'Click again to confirm'
                          : 'Remove repository'
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bottom spacing */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  )
}

export default Settings
