import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import VaLogo from './VaLogo'

function StatCard({ label, value, invert = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        invert
          ? 'border-green-700 bg-green-700 text-white'
          : 'border-green-200 bg-white text-green-900'
      }`}
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          invert ? 'text-green-100' : 'text-green-700'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  )
}

const BADGE_STYLES = {
  Reporting:
    'bg-green-700 text-white border border-green-700',
  Moving: 'bg-green-700 text-white border border-green-700',
  'Not Reporting':
    'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
  'Excess Idling':
    'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
  Idle: 'bg-white text-neutral-600 border border-neutral-300',
  Parked: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
  'No Activity Since Yesterday':
    'bg-white text-neutral-600 border border-dashed border-neutral-400',
  Ok: 'bg-brand-600 text-white border border-brand-600',
}

const BADGE_DOTS = {
  Reporting: 'bg-white',
  Moving: 'bg-white',
  'Not Reporting': 'bg-amber-500',
  'Excess Idling': 'bg-amber-500',
}

function StatusBadge({ value }) {
  const style = BADGE_STYLES[value]
  const dot = BADGE_DOTS[value]
  if (!style) {
    return (
      <span className="inline-block rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap text-neutral-600">
        {value ?? '—'}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase ${style}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {value}
    </span>
  )
}

function BatteryValue({ value }) {
  if (value === null || value === undefined || value === 0) {
    return <span className="text-neutral-400">—</span>
  }
  const low = value < 11.5
  if (low) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-amber-900 uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {Number(value).toFixed(2)} V
      </span>
    )
  }
  return (
    <span className="text-sm font-medium text-green-800">
      {Number(value).toFixed(2)} V
    </span>
  )
}

function formatTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function VehicleStatusTab({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [stamp, setStamp] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/vehicle/getstatus', { token })
      setData(result)
      setStamp(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const vehicles = data?.vehicles ?? []
  const counts = data?.counts ?? {}
  const hasCounts = counts.totalCount !== undefined

  return (
    <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <VaLogo className="h-11 w-11" />
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Automation
            </p>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Vehicle Status
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Live status of the entire fleet
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
            <div>
              <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                Generated
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
                {formatTime(stamp)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                Vehicles
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
                {hasCounts ? counts.totalCount : '—'}
              </dd>
            </div>
          </dl>
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh vehicle status"
            className="btn-shine relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-green-700 to-green-600 text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${loading ? 'anim-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-6 mt-5 border-l-4 border-green-700 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {error}
        </p>
      )}

      {hasCounts && (
        <div className="grid grid-cols-2 gap-3 border-b border-neutral-200 px-6 py-5 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={counts.totalCount} invert />
          <StatCard label="Reporting" value={counts.reportingCount} />
          <StatCard label="Not Reporting" value={counts.notReportingCount} />
          <StatCard label="Moving" value={counts.movingCount} />
          <StatCard label="Parked" value={counts.parkedCount} />
          <StatCard label="Idling" value={counts.idlingCount} />
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-3 px-6 py-8 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
          Loading vehicle status...
        </div>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <p className="px-6 py-8 text-sm text-neutral-500">No vehicles found.</p>
      )}

      {vehicles.length > 0 && (
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                <th className="px-4 py-2.5 font-semibold">Vehicle Reg No.</th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Region
                </th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Reporting Date/Time
                </th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Location
                </th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Reporting Status
                </th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Status Text
                </th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Battery Status
                </th>
                <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                  Wiring Status
                </th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr
                  key={v.regNo + i}
                  className={`border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-100 ${
                    i % 2 === 1 ? 'bg-green-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-ink">
                    {v.regNo}
                  </td>
                  <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                    {v.region}
                  </td>
                  <td className="border-l border-neutral-300 px-4 py-3 whitespace-nowrap tabular-nums text-neutral-600">
                    {v.reportingDateTime?.replace('T', ' ')}
                  </td>
                  <td
                    className="max-w-xs truncate border-l border-neutral-300 px-4 py-3 text-neutral-500"
                    title={v.location}
                  >
                    {v.location}
                  </td>
                  <td className="border-l border-neutral-300 px-4 py-3">
                    <StatusBadge value={v.reportingStatus} />
                  </td>
                  <td className="border-l border-neutral-300 px-4 py-3">
                    <StatusBadge value={v.statusText} />
                  </td>
                  <td className="border-l border-neutral-300 px-4 py-3">
                    <BatteryValue value={v.batteryStatus} />
                  </td>
                  <td className="border-l border-neutral-300 px-4 py-3">
                    <StatusBadge value={v.wirringStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-700" />
            Reporting / Moving — vehicle is live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Not Reporting / Excess Idling — needs attention
          </span>
        </div>
        <p className="text-[11px] text-green-800">
          Source: TrackingWorld · Generated {formatTime(stamp)}
        </p>
      </div>
      <div className="h-1 w-full bg-green-700" />
    </div>
  )
}
