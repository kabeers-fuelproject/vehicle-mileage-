import { Suspense, lazy, useState, useEffect, useRef } from 'react'
import Login from './components/Login'
import VehicleStatusTab from './components/VehicleStatusTab'
import NotificationBell from './components/NotificationBell'
import { NotificationProvider, useNotifications } from './NotificationContext'
import { SelectionProvider } from './SelectionContext'
import { ThresholdProvider } from './ThresholdContext'

// Split every non-default tab into its own chunk so the initial download stays
// small. Heavy dependencies (jspdf, html-to-image, leaflet) only ship with the
// tabs that actually use them.
const TAB_LOADERS = {
  'vehicle-data': () => import('./components/VehicleDataTab'),
  'trip-history': () => import('./components/TripHistoryTab'),
  distance: () => import('./components/DistanceReportTab'),
  mileage: () => import('./components/MileageUpdateTab'),
  threshold: () => import('./components/ThresholdTab'),
  settings: () => import('./components/SettingsTab'),
  'assigned-vehicles': () => import('./components/AssignedVehiclesTab'),
  summary: () => import('./components/SummaryTab'),
  'code-discrepancy': () => import('./components/CodeDiscrepancyTab'),
  history: () => import('./components/HistoryTab'),
  'suthra-lr-beat': () => import('./suthra-punjab-portal/SuthraPunjabPortal'),
}

const LAZY_TABS = Object.fromEntries(
  Object.entries(TAB_LOADERS).map(([id, loader]) => [id, lazy(loader)]),
)

const TABS = [
  { id: 'status', label: 'Vehicle Status' },
  { id: 'vehicle-data', label: 'Vehicle Data' },
  { id: 'trip-history', label: 'Trip History' },
  { id: 'distance', label: 'Distance Report' },
  { id: 'mileage', label: 'Mileage Update' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'settings', label: 'Threshold Settings' },
  { id: 'assigned-vehicles', label: 'Assigned Vehicles' },
  { id: 'summary', label: 'Summary' },
  { id: 'code-discrepancy', label: 'Code Discrepancy' },
  { id: 'history', label: 'History' },
  { id: 'suthra-lr-beat', label: 'LR Beat Report' },
]

const TAB_ICONS = {
  status: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  'vehicle-data': (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H8.7c-.6 0-1.2.3-1.6.8L4 12c-.6.5-1 1.2-1 2v2c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  'trip-history': (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  distance: (
    <>
      <path d="M21.3 8.7 15.3 2.7a1 1 0 0 0-1.4 0L2.7 13.9a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0L21.3 10.1a1 1 0 0 0 0-1.4Z" />
      <path d="m7.5 10.5 2 2" />
      <path d="m10.5 7.5 2 2" />
      <path d="m13.5 4.5 2 2" />
    </>
  ),
  mileage: (
    <>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </>
  ),
  threshold: (
    <>
      <path d="M3 4h11M18 4h3M3 12h5M12 12h9M3 20h9M16 20h5" />
      <path d="M16 2v4M10 10v4M14 18v4" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'assigned-vehicles': (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  summary: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  'code-discrepancy': (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  'suthra-lr-beat': (
    <>
      <path d="M3 17h18" />
      <path d="M5 17V7l8-4v10" />
      <path d="M19 17v-6l-6-4" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="15" cy="13" r="1.5" />
    </>
  ),
}

const POLL_INTERVAL_MS = 60 * 1000

function useMileagePolling(token) {
  const { refreshFingerprint } = useNotifications()
  const refreshRef = useRef(refreshFingerprint)
  useEffect(() => { refreshRef.current = refreshFingerprint }, [refreshFingerprint])

  useEffect(() => {
    if (!token) return
    refreshRef.current(token)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshRef.current(token)
      }
    }, POLL_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshRef.current(token)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token])
}

function TabFallback() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-neutral-400 bg-white px-6 py-16 text-sm text-neutral-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
      Loading section…
    </div>
  )
}

function TabIcon({ id }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TAB_ICONS[id]}
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

function AppContent() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === '1',
  )
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    return TABS.some((t) => t.id === requested) ? requested : 'status'
  })
  const { markMileageViewed } = useNotifications()
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]
  const ActiveLazyTab = tab === 'status' ? null : LAZY_TABS[tab]

  useMileagePolling(token)

  useEffect(() => {
    if (!token) return
    const prefetch = () => {
      Object.values(TAB_LOADERS).forEach((load) => load().catch(() => {}))
    }
    const hasIdle = typeof window.requestIdleCallback === 'function'
    const handle = hasIdle
      ? window.requestIdleCallback(prefetch, { timeout: 3000 })
      : window.setTimeout(prefetch, 2000)
    return () => {
      if (hasIdle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [token])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (tab === 'mileage') {
      markMileageViewed()
    }
  }, [tab, markMileageViewed])

  if (!token) return <Login onLogin={setToken} />

  function handleLogout() {
    try {
      import('./activityLogger').then(({ logActivity }) => {
        import('./deviceInfo').then(({ getDeviceDisplayName }) => {
          logActivity('logout', `Signed out from ${getDeviceDisplayName()}`)
        })
      })
    } catch {}
    localStorage.removeItem('token')
    setToken(null)
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-ink lg:flex">
      <aside
        className={`hidden border-r border-green-100 bg-white transition-[width] duration-300 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:self-start lg:flex-col ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-64'
        }`}
      >
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-green-600 via-green-300 to-green-600" />

        <div
          className={`flex shrink-0 border-b border-green-100 ${
            collapsed
              ? 'flex-col items-center gap-2 px-2 py-4'
              : 'items-center gap-3 px-5 py-5'
          }`}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[9px] leading-tight font-semibold tracking-widest text-green-700 uppercase">
                Vehicle Automation
              </p>
              <h1 className="text-sm leading-tight font-bold tracking-tight text-ink">
                Fleet Control Center
              </h1>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="desktop-sidebar-nav"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-green-200 bg-white text-green-700 transition-colors hover:border-green-600 hover:bg-green-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500/20 ${
              collapsed ? '' : 'ml-auto'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform duration-300 ${
                collapsed ? '' : 'rotate-180'
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        </div>

        <nav
          id="desktop-sidebar-nav"
          aria-label="Sections"
          className={`flex-1 space-y-1 overflow-y-auto py-4 ${
            collapsed ? 'px-2' : 'px-3'
          }`}
        >
          <p
            className={
              collapsed
                ? 'sr-only'
                : 'px-3 pb-2 text-[10px] font-semibold tracking-widest text-neutral-400 uppercase'
            }
          >
            Sections
          </p>
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={t.label}
                title={collapsed ? t.label : undefined}
                className={`flex w-full items-center rounded-lg text-sm font-medium transition-colors ${
                  collapsed
                    ? 'justify-center px-0 py-2.5'
                    : 'gap-2.5 px-3 py-2.5 text-left'
                } ${
                  active
                    ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
                    : 'text-neutral-600 hover:bg-green-50 hover:text-green-800'
                }`}
              >
                <TabIcon id={t.id} />
                {!collapsed && <span className="truncate">{t.label}</span>}
              </button>
            )
          })}
        </nav>

        <div
          className={`shrink-0 border-t border-green-100 py-4 ${
            collapsed ? 'px-2' : 'px-4'
          }`}
        >
          <button
            onClick={handleLogout}
            aria-label="Logout"
            title={collapsed ? 'Logout' : undefined}
            className={
              collapsed
                ? 'mx-auto grid h-9 w-9 place-items-center rounded-full bg-green-600 text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:bg-green-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500/20'
                : 'group flex w-full items-center justify-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:bg-green-700 hover:shadow-green-600/40 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-500/20'
            }
          >
            <LogoutIcon />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 lg:hidden">
          <div className="h-1 w-full bg-gradient-to-r from-green-600 via-green-300 to-green-600" />
          <header className="border-b border-green-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] leading-tight font-semibold tracking-widest text-green-700 uppercase">
                    Vehicle Automation
                  </p>
                  <h1 className="truncate text-base leading-tight font-bold tracking-tight text-ink">
                    Fleet Control Center
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls="app-tab-menu"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green-200 bg-white text-green-700 transition-colors hover:border-green-600 hover:bg-green-50 active:scale-95"
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
            </div>

            {menuOpen && (
              <nav
                id="app-tab-menu"
                aria-label="Sections"
                className="anim-menu-in border-t border-green-100 bg-white"
              >
                <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTab(t.id)
                        setMenuOpen(false)
                      }}
                      aria-current={tab === t.id ? 'page' : undefined}
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
                    <div className="flex justify-center pb-2">
                      <NotificationBell />
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        handleLogout()
                      }}
                      className="group flex items-center justify-center gap-2 rounded-full bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:bg-green-700 hover:shadow-green-600/40 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    >
                      <LogoutIcon />
                      Logout
                    </button>
                  </div>
                </div>
              </nav>
            )}
          </header>
        </div>

        <div className="sticky top-0 z-20 hidden border-b border-green-100 bg-white/95 backdrop-blur lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-ink">
                {activeTab.label}
              </h2>
            </div>
            <div className="shrink-0">
              <NotificationBell />
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Suspense fallback={<TabFallback />}>
            {tab === 'status' && <VehicleStatusTab token={token} />}
            {ActiveLazyTab && <ActiveLazyTab token={token} />}
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThresholdProvider>
      <NotificationProvider>
        <SelectionProvider>
          <AppContent />
        </SelectionProvider>
      </NotificationProvider>
    </ThresholdProvider>
  )
}
