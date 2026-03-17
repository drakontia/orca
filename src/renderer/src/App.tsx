import { useEffect } from 'react'
import { useAppStore } from './store'
import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import Landing from './components/Landing'

function App(): React.JSX.Element {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const showTerminal = useAppStore((s) => s.showTerminal)
  const setShowTerminal = useAppStore((s) => s.setShowTerminal)
  const terminalTitle = useAppStore((s) => s.terminalTitle)

  // Enter key on landing page to spawn a new terminal
  useEffect(() => {
    if (showTerminal) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault()
        setShowTerminal(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showTerminal, setShowTerminal])

  return (
    <div className="app-layout">
      <div className="titlebar">
        <div className="titlebar-traffic-light-pad" />
        <button className="sidebar-toggle" onClick={toggleSidebar} title="Toggle sidebar">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </svg>
        </button>
        <div className="titlebar-title">
          {showTerminal && terminalTitle ? terminalTitle : 'Orca'}
        </div>
        <div className="titlebar-spacer" />
      </div>
      <div className="content-area">
        <Sidebar />
        {showTerminal ? <Terminal /> : <Landing />}
      </div>
    </div>
  )
}

export default App
