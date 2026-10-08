import { useState } from 'react'
import DistanceReportTab from './components/DistanceReportTab'
import Login from './components/Login'
import MileageUpdateTab from './components/MileageUpdateTab'
import AssignedVehiclesTab from './components/AssignedVehiclesTab'
import ThresholdTab from './components/ThresholdTab'
import VehicleStatusTab from './components/VehicleStatusTab'
import VaLogo from './components/VaLogo'

const TABS = [
  { id: 'status', label: 'Vehicle Status' },
  { id: 'distance', label: 'Distance Report' },
  { id: 'mileage', label: 'Mileage Update' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'assigned-vehicles', label: 'Assigned Vehicles' },
]

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [menuOpen, setMenuOpen] = useState(false)
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
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="app-tab-menu"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green-200 bg-white text-green-700 transition-colors hover:border-green-600 hover:bg-green-50 active:scale-95 lg:hidden"
            >
              <span className="relative block h-4 w-5" aria-hidden="true">
                <span
                  className={`absolute inset-x-0 top-0 h-0.5 rounded-full bg-current transition-transform duration-300 ease-out ${
                    menuOpen ? 'translate-y-[7px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-current transition-all duration-300 ${
                    menuOpen ? 'scale-x-0 opacity-0' : ''
                  }`}
                />
                <span
                  className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-current transition-transform duration-300 ease-out ${
                    menuOpen ? '-translate-y-[7px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>

            <div className="flex items-center gap-3">
              <VaLogo className="h-9 w-9 shrink-0" />
              <div className="hidden sm:block">
                <p className="text-[9px] leading-tight font-semibold tracking-widest text-green-700 uppercase">
                  Vehicle Automation
                </p>
                <h1 className="text-base leading-tight font-bold tracking-tight text-ink">
                  Fleet Control Center
                </h1>
              </div>
            </div>

            <nav className="hidden items-center gap-1 rounded-full border border-green-100 bg-green-50/60 p-1 lg:flex">
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
              className="group hidden items-center gap-2 rounded-full border border-green-600 bg-green-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:bg-green-700 hover:border-green-700 active:scale-95 lg:flex"
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

          {menuOpen && (
            <nav
              id="app-tab-menu"
              className="anim-menu-in border-t border-green-100 bg-white lg:hidden"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id)
                      setMenuOpen(false)
                    }}
                    className={`rounded-lg px-4 py-2.5 text-left text-sm font-semibold whitespace-nowrap transition-colors ${
                      tab === t.id
                        ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
                        : 'text-neutral-600 hover:bg-green-100/70 hover:text-green-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <div className="mt-2 flex flex-col gap-1 border-t border-green-100 pt-3">
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      handleLogout()
                    }}
                    className="group flex items-center justify-center gap-2 rounded-full border border-green-600 bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:border-green-700 hover:bg-green-700 active:scale-95"
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
              </div>
            </nav>
          )}
        </header>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'status' && <VehicleStatusTab token={token} />}
        {tab === 'distance' && <DistanceReportTab token={token} />}
        {tab === 'mileage' && <MileageUpdateTab token={token} />}
        {tab === 'threshold' && <ThresholdTab />}
        {tab === 'assigned-vehicles' && <AssignedVehiclesTab token={token} />}
      </main>
    </div>
  )
}
