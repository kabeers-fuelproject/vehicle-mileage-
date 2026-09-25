import { useState } from 'react'
import DistanceReportTab from './components/DistanceReportTab'
import Login from './components/Login'
import MileageUpdateTab from './components/MileageUpdateTab'
import ThresholdTab from './components/ThresholdTab'
import VehicleStatusTab from './components/VehicleStatusTab'

const TABS = [
  { id: 'status', label: 'Vehicle Status' },
  { id: 'distance', label: 'Distance Report' },
  { id: 'mileage', label: 'Mileage Update' },
  { id: 'threshold', label: 'Threshold' },
]

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    return TABS.some((t) => t.id === requested) ? requested : 'status'
  })

  if (!token) return <Login onLogin={setToken} />

  function handleLogout() {
    localStorage.removeItem('token')
    setToken(null)
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-black">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-black text-xs font-bold text-white">
              VA
            </span>
            <h1 className="text-base font-semibold tracking-tight">
              Vehicle Automation
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-black px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-black hover:text-white"
          >
            Logout
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-6 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
                tab === t.id
                  ? 'border-black font-semibold text-black'
                  : 'border-transparent text-neutral-400 hover:text-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === 'status' && <VehicleStatusTab token={token} />}
        {tab === 'distance' && <DistanceReportTab token={token} />}
        {tab === 'mileage' && <MileageUpdateTab token={token} />}
        {tab === 'threshold' && <ThresholdTab />}
      </main>
    </div>
  )
}
