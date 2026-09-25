import { useState } from 'react'
import DistanceReportTab from './components/DistanceReportTab'
import Login from './components/Login'
import VehicleStatusTab from './components/VehicleStatusTab'

const TABS = [
  { id: 'status', label: 'Vehicle Status' },
  { id: 'distance', label: 'Distance Report' },
]

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    return requested === 'distance' ? 'distance' : 'status'
  })

  if (!token) return <Login onLogin={setToken} />

  function handleLogout() {
    localStorage.removeItem('token')
    setToken(null)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold text-slate-800">
            Vehicle Automation
          </h1>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? 'border-b-2 border-blue-600 px-4 py-2.5 text-sm font-medium text-blue-600'
                  : 'border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700'
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {tab === 'status' ? (
          <VehicleStatusTab token={token} />
        ) : (
          <DistanceReportTab token={token} />
        )}
      </main>
    </div>
  )
}
