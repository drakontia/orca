import { useEffect, useRef } from 'react'
import { Restty, getBuiltinTheme } from 'restty'
import { useAppStore } from '../store'

type PtyTransport = {
  connect: (options: {
    url: string
    cols?: number
    rows?: number
    callbacks: {
      onConnect?: () => void
      onDisconnect?: () => void
      onData?: (data: string) => void
      onStatus?: (shell: string) => void
      onError?: (message: string, errors?: string[]) => void
      onExit?: (code: number) => void
    }
  }) => void | Promise<void>
  disconnect: () => void
  sendInput: (data: string) => boolean
  resize: (
    cols: number,
    rows: number,
    meta?: { widthPx?: number; heightPx?: number; cellW?: number; cellH?: number }
  ) => boolean
  isConnected: () => boolean
  destroy?: () => void | Promise<void>
}

// OSC 0/1/2 title regex: \x1b]N;title(\x07|\x1b\\)
// Handles both BEL and ST terminators, and partial sequences across chunks
const OSC_TITLE_RE = /\x1b\]([012]);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g

function extractLastOscTitle(data: string): string | null {
  let last: string | null = null
  let m: RegExpExecArray | null
  OSC_TITLE_RE.lastIndex = 0
  while ((m = OSC_TITLE_RE.exec(data)) !== null) {
    last = m[2]
  }
  return last
}

function createIpcPtyTransport(
  cwd?: string,
  onPtyExit?: () => void,
  onTitleChange?: (title: string) => void
): PtyTransport {
  let connected = false
  let ptyId: string | null = null
  let storedCallbacks: {
    onConnect?: () => void
    onDisconnect?: () => void
    onData?: (data: string) => void
    onStatus?: (shell: string) => void
    onError?: (message: string, errors?: string[]) => void
    onExit?: (code: number) => void
  } = {}
  let unsubData: (() => void) | null = null
  let unsubExit: (() => void) | null = null

  return {
    async connect(options) {
      storedCallbacks = options.callbacks

      try {
        const result = await window.api.pty.spawn({
          cols: options.cols ?? 80,
          rows: options.rows ?? 24,
          cwd
        })
        ptyId = result.id
        connected = true

        unsubData = window.api.pty.onData((payload) => {
          if (payload.id === ptyId) {
            storedCallbacks.onData?.(payload.data)
            if (onTitleChange) {
              const title = extractLastOscTitle(payload.data)
              if (title !== null) onTitleChange(title)
            }
          }
        })

        unsubExit = window.api.pty.onExit((payload) => {
          if (payload.id === ptyId) {
            connected = false
            storedCallbacks.onExit?.(payload.code)
            storedCallbacks.onDisconnect?.()
            onPtyExit?.()
          }
        })

        storedCallbacks.onConnect?.()
        storedCallbacks.onStatus?.('shell')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        storedCallbacks.onError?.(msg)
      }
    },

    disconnect() {
      if (ptyId) {
        window.api.pty.kill(ptyId)
        connected = false
        ptyId = null
        unsubData?.()
        unsubExit?.()
        unsubData = null
        unsubExit = null
        storedCallbacks.onDisconnect?.()
      }
    },

    sendInput(data: string): boolean {
      if (!connected || !ptyId) return false
      window.api.pty.write(ptyId, data)
      return true
    },

    resize(cols: number, rows: number): boolean {
      if (!connected || !ptyId) return false
      window.api.pty.resize(ptyId, cols, rows)
      return true
    },

    isConnected() {
      return connected
    },

    destroy() {
      this.disconnect()
    }
  }
}

export default function Terminal(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const resttyRef = useRef<Restty | null>(null)
  const activeWorktree = useAppStore((s) => s.activeWorktree)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const cwd = activeWorktree ?? undefined

    // Map pane id -> its associated pty transport exit handler
    const paneCloseQueue: number[] = []
    let closeTimer: ReturnType<typeof setTimeout> | null = null

    function scheduleClose(paneId: number): void {
      paneCloseQueue.push(paneId)
      if (closeTimer) return
      // Batch close on next tick to avoid issues during restty callbacks
      closeTimer = setTimeout(() => {
        closeTimer = null
        const restty = resttyRef.current
        if (!restty) return
        while (paneCloseQueue.length > 0) {
          const id = paneCloseQueue.shift()!
          const panes = restty.getPanes()
          if (panes.length <= 1) {
            // Last pane — go to landing
            useAppStore.getState().setShowTerminal(false)
            return
          }
          restty.closePane(id)
        }
      }, 0)
    }

    // Track per-pane titles
    const paneTitles = new Map<number, string>()
    let currentActivePaneId: number | null = null

    function syncTitleToStore(): void {
      if (currentActivePaneId !== null) {
        const title = paneTitles.get(currentActivePaneId) ?? ''
        useAppStore.getState().setTerminalTitle(title)
      } else {
        useAppStore.getState().setTerminalTitle('')
      }
    }

    const restty = new Restty({
      root: container,
      createInitialPane: false,
      autoInit: false,
      shortcuts: { enabled: true },
      appOptions: ({ id }) => {
        const onPtyExit = (): void => {
          scheduleClose(id)
        }
        const onTitleChange = (title: string): void => {
          paneTitles.set(id, title)
          if (id === currentActivePaneId) {
            useAppStore.getState().setTerminalTitle(title)
          }
        }
        return {
          renderer: 'webgpu',
          fontSize: 14,
          fontSizeMode: 'em',
          alphaBlending: 'native',
          ptyTransport: createIpcPtyTransport(cwd, onPtyExit, onTitleChange) as never,
          fontSources: [
            {
              type: 'local' as const,
              label: 'SF Mono',
              matchers: ['sf mono', 'sfmono-regular'],
              required: true
            },
            {
              type: 'local' as const,
              label: 'Menlo',
              matchers: ['menlo', 'menlo regular']
            }
          ]
        }
      },
      onPaneCreated: async (pane) => {
        await pane.app.init()
        const theme = getBuiltinTheme('Aizen Dark')
        if (theme) pane.app.applyTheme(theme, 'Aizen Dark')
        pane.app.updateSize(true)
        pane.app.connectPty('')
        pane.canvas.focus({ preventScroll: true })
      },
      onPaneClosed: (pane) => {
        paneTitles.delete(pane.id)
      },
      onActivePaneChange: (pane) => {
        currentActivePaneId = pane?.id ?? null
        syncTitleToStore()
      }
    })

    restty.createInitialPane({ focus: true })
    resttyRef.current = restty

    // --- Pane zoom state ---
    let zoomedPaneId: number | null = null
    const savedStyles: { el: HTMLElement; prop: string; prev: string }[] = []

    function saveAndSet(el: HTMLElement, prop: string, value: string): void {
      savedStyles.push({
        el,
        prop,
        prev: (el.style as unknown as Record<string, string>)[prop] ?? ''
      })
      ;(el.style as unknown as Record<string, string>)[prop] = value
    }

    function unzoom(): void {
      if (zoomedPaneId === null) return
      for (const entry of savedStyles) {
        ;(entry.el.style as unknown as Record<string, string>)[entry.prop] = entry.prev
      }
      savedStyles.length = 0
      zoomedPaneId = null
      requestAnimationFrame(() => {
        for (const p of restty.getPanes()) {
          p.app.updateSize(true)
        }
      })
    }

    function togglePaneZoom(): void {
      const panes = restty.getPanes()

      if (zoomedPaneId !== null) {
        unzoom()
        return
      }

      if (panes.length <= 1) return

      const active = restty.getActivePane() ?? panes[0]
      if (!active) return

      let current: HTMLElement = active.container
      saveAndSet(current, 'flex', '1 1 100%')

      while (current.parentElement) {
        const parent = current.parentElement
        for (const sibling of Array.from(parent.children) as HTMLElement[]) {
          if (sibling === current) continue
          saveAndSet(sibling, 'display', 'none')
        }
        if (parent === container) break
        saveAndSet(parent, 'flex', '1 1 100%')
        current = parent
      }

      zoomedPaneId = active.id
      requestAnimationFrame(() => {
        active.app.updateSize(true)
      })
    }

    function closeActivePane(): void {
      const panes = restty.getPanes()
      const active = restty.getActivePane() ?? panes[0]
      if (!active) return

      // If zoomed and closing the zoomed pane, unzoom first
      if (zoomedPaneId === active.id) {
        unzoom()
      }

      if (panes.length <= 1) {
        // Last pane — disconnect PTY and go to landing
        active.app.disconnectPty()
        useAppStore.getState().setShowTerminal(false)
        return
      }
      // Disconnect PTY then close the pane
      active.app.disconnectPty()
      restty.closePane(active.id)
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      // Cmd+K: clear screen
      if (e.metaKey && e.key === 'k' && !e.shiftKey && !e.repeat) {
        e.preventDefault()
        const pane = restty.getActivePane() ?? restty.getPanes()[0]
        if (pane) {
          pane.app.clearScreen()
        }
        return
      }

      // Cmd+W: close active pane (not the window)
      if (e.metaKey && e.key === 'w' && !e.shiftKey && !e.repeat) {
        e.preventDefault()
        closeActivePane()
        return
      }

      // Cmd+] / Cmd+[: cycle through panes
      if (e.metaKey && !e.shiftKey && (e.key === ']' || e.key === '[') && !e.repeat) {
        const panes = restty.getPanes()
        if (panes.length > 1) {
          e.preventDefault()
          const active = restty.getActivePane()
          const idx = active ? panes.findIndex((p) => p.id === active.id) : -1
          const dir = e.key === ']' ? 1 : -1
          const next = panes[(idx + dir + panes.length) % panes.length]
          if (next) {
            next.canvas.focus({ preventScroll: true })
          }
        }
        return
      }

      // Cmd+Shift+Enter: toggle pane zoom
      if (e.metaKey && e.shiftKey && e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        togglePaneZoom()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      if (closeTimer) clearTimeout(closeTimer)
      restty.destroy()
      resttyRef.current = null
    }
  }, [activeWorktree])

  return <div className="terminal-container" ref={containerRef} />
}
