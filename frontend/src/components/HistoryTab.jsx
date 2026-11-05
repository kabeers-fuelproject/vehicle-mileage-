import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import VaLogo from './VaLogo'

function formatDateTime(dateStr) {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getActivityIcon(type) {
  if (type?.includes('pdf') || type?.includes('download')) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    )
  }
  if (type === 'login') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    )
  }
  if (type === 'logout') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
    </svg>
  )
}

export default function HistoryTab() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function loadHistory() {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('activity_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('activity_type', filter)
      }

      const { data, error: dbError } = await query
      if (dbError) throw dbError
      setHistory(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [filter])

  const activityTypes = ['all', 'login', 'logout', 'distance_report_pdf', 'mileage_update_pdf', 'summary_pdf']

  const stats = {
    total: history.length,
    pdfDownloads: history.filter(h => h.activity_type?.includes('pdf') || h.activity_type?.includes('download')).length,
    logins: history.filter(h => h.activity_type === 'login').length,
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-4">
          <VaLogo className="h-11 w-11" />
          <div>
            <h2 className="text-lg font-bold text-ink">Activity History</h2>
            <p className="text-sm text-neutral-600">Track logins, downloads and activities</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="rounded-lg bg-green-50 px-3 py-1.5">
            <span className="font-semibold text-green-900">{stats.total}</span>
            <span className="text-green-700"> Total</span>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-1.5">
            <span className="font-semibold text-blue-900">{stats.logins}</span>
            <span className="text-blue-700"> Logins</span>
          </div>
          <div className="rounded-lg bg-purple-50 px-3 py-1.5">
            <span className="font-semibold text-purple-900">{stats.pdfDownloads}</span>
            <span className="text-purple-700"> PDF Downloads</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 sm:px-6">
        <span className="text-xs font-semibold text-neutral-600">Filter:</span>
        {activityTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === type
                ? 'bg-green-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {type === 'all' ? 'All' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="h-12 w-12 text-neutral-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="text-sm font-medium text-neutral-500">No activity history yet</p>
            <p className="mt-1 text-xs text-neutral-400">Downloads will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-green-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-green-700 uppercase">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-green-700 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-green-700 uppercase">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={item.id} className={`border-b border-neutral-100 hover:bg-green-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
                          {getActivityIcon(item.activity_type)}
                        </div>
                        <span className="text-sm font-medium text-ink">
                          {item.activity_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700">
                      {item.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 tabular-nums">
                      {formatDateTime(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
