import { useAppStore } from '../store'

export default function Landing(): React.JSX.Element {
  const setShowTerminal = useAppStore((s) => s.setShowTerminal)

  return (
    <div className="landing">
      <div className="landing-content">
        <h1 className="landing-title">Orca</h1>
        <button className="landing-action" onClick={() => setShowTerminal(true)}>
          New Terminal
        </button>
        <span className="landing-hint">or press Enter</span>
      </div>
    </div>
  )
}
