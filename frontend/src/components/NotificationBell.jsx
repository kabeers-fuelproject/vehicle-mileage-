import { useState, useRef, useEffect, useMemo } from 'react'
import { useNotifications } from '../NotificationContext'

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getTypeStyles(type) {
  switch (type) {
    case 'success':
      return { dot: 'bg-green-500', border: 'border-green-200', hover: 'hover:bg-green-50' }
    case 'warning':
      return { dot: 'bg-amber-500', border: 'border-amber-200', hover: 'hover:bg-amber-50' }
    case 'error':
      return { dot: 'bg-red-500', border: 'border-red-200', hover: 'hover:bg-red-50' }
    case 'info':
    default:
      return { dot: 'bg-blue-500', border: 'border-blue-200', hover: 'hover:bg-blue-50' }
  }
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllRead,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleBellClick() {
    setOpen((prev) => !prev)
  }

  async function handleItemClick(n) {
    if (!n.is_read) await markNotificationRead(n.id)
  }

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [notifications]
  )

  return (
    <div className="relative">
<button
        ref={buttonRef}
        type="button"
        onClick={handleBellClick}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green-200 bg-white text-green-700 transition-colors hover:border-green-600 hover:bg-green-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500/20"
      >
        <span className="relative" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.268 21a2 2 0 0 0 3.464 0" />
            <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white animate-pulse shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="anim-menu-in absolute right-0 z-50 mt-2 w-88 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3">
            <h4 className="text-xs font-semibold tracking-wider text-neutral-600 uppercase">
              Notifications
            </h4>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-green-600 transition-colors hover:text-green-700 hover:underline focus:outline-none focus:ring-2 focus:ring-green-500/20 rounded"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {sortedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <svg
                  className="h-10 w-10 text-neutral-300 mb-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p className="text-sm font-medium text-neutral-500">No notifications yet</p>
                <p className="mt-1 text-xs text-neutral-400">You're all caught up</p>
              </div>
            ) : (
              sortedNotifications.map((n) => {
                const type = n.type ?? 'info'
                const styles = getTypeStyles(type)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b last:border-0 ${styles.hover} ${
                      n.is_read ? 'opacity-70' : 'font-medium'
                    }`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleItemClick(n)
                      }
                    }}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink leading-snug">
                        {n.title}
                      </span>
                      {n.message && (
                        <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                          {n.message}
                        </span>
                      )}
                      <span className="mt-1.5 block text-[10px] text-neutral-400">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {!n.is_read && (
                      <span
                        className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                )
              })
            )}
            {unreadCount > 0 && sortedNotifications.length > 0 && (
              <div className="border-t border-neutral-100 px-4 py-2">
                <button
                  type="button"
                  onClick={markAllRead}
                  className="w-full text-xs font-medium text-neutral-500 transition-colors hover:text-green-600 hover:underline"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}