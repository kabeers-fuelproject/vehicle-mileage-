import { useState } from 'react'
import DistanceReportTab from './components/DistanceReportTab'
import Login from './components/Login'
import MileageUpdateTab from './components/MileageUpdateTab'
import ThresholdTab from './components/ThresholdTab'
import VehicleStatusTab from './components/VehicleStatusTab'
import VaLogo from './components/VaLogo'

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
    <div className="min-h-screen bg-neutral-50 text-ink">
      <div className="sticky top-0 z-20">
        <div className="h-1 w-full bg-gradient-to-r from-green-600 via-green-300 to-green-600" />
        <header className="border-b border-green-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-3">
              <VaLogo className="h-9 w-9" />
              <div>
                <p className="text-[9px] leading-tight font-semibold tracking-widest text-green-700 uppercase">
                  Vehicle Automation
                </p>
                <h1 className="text-base leading-tight font-bold tracking-tight text-ink">
                  Fleet Control Center
                </h1>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-1 rounded-full border border-green-100 bg-green-50/60 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-all duration-200 ${
                    tab === t.id
                      ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
                      : 'text-neutral-500 hover:bg-green-100/70 hover:text-green-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-2 rounded-full border border-green-600 bg-green-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:bg-green-700 hover:border-green-700 active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-90"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Logout
            </button>
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === 'status' && <VehicleStatusTab token={token} />}
        {tab === 'distance' && <DistanceReportTab token={token} />}
        {tab === 'mileage' && <MileageUpdateTab token={token} />}
        {tab === 'threshold' && <ThresholdTab />}
      </main>
    </div>
  )
}
