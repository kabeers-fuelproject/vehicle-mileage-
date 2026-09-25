import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

function StatCard({ label, value, invert = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        invert
          ? 'border-black bg-black text-white'
          : 'border-neutral-200 bg-white text-black'
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wider ${
          invert ? 'text-neutral-400' : 'text-neutral-500'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  )
}

const BADGE_STYLES = {
  Reporting: 'bg-black text-white border border-black',
  'Not Reporting': 'bg-white text-black border-2 border-black font-semibold',
  Moving: 'bg-black text-white border border-black',
  Idle: 'bg-white text-black border border-neutral-300',
  'Excess Idling': 'bg-white text-black border-2 border-black font-semibold',
  Parked: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
  'No Activity Since Yesterday':
    'bg-white text-black border border-dashed border-black',
  Ok: 'bg-black text-white border border-black',
}

function StatusBadge({ value }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${
        BADGE_STYLES[value] || 'bg-neutral-100 text-neutral-600 border border-neutral-200'
      }`}
    >
      {value ?? '—'}
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
      <span className="rounded bg-black px-1.5 py-0.5 text-xs font-semibold text-white">
        {Number(value).toFixed(2)} V
      </span>
    )
  }
  return <span className="text-neutral-600">{Number(value).toFixed(2)} V</span>
}

export default function VehicleStatusTab({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/vehicle/getstatus', { token })
      setData(result)
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Vehicle Status</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Live status of the entire fleet
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="mt-4 border-l-4 border-black bg-neutral-100 px-4 py-3 text-sm font-medium text-black">
          {error}
        </p>
      )}

      {counts.totalCount !== undefined && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={counts.totalCount} invert />
          <StatCard label="Reporting" value={counts.reportingCount} />
          <StatCard label="Not Reporting" value={counts.notReportingCount} />
          <StatCard label="Moving" value={counts.movingCount} />
          <StatCard label="Parked" value={counts.parkedCount} />
          <StatCard label="Idling" value={counts.idlingCount} />
        </div>
      )}

      {loading && !data && (
        <div className="mt-8 flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
          Loading vehicle status...
        </div>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500">No vehicles found.</p>
      )}

      {vehicles.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black text-[11px] uppercase tracking-wider text-white">
                <th className="px-4 py-3.5 font-semibold">Vehicle Reg No.</th>
                <th className="px-4 py-3.5 font-semibold">Region</th>
                <th className="px-4 py-3.5 font-semibold">
                  Reporting Date/Time
                </th>
                <th className="px-4 py-3.5 font-semibold">Location</th>
                <th className="px-4 py-3.5 font-semibold">Reporting Status</th>
                <th className="px-4 py-3.5 font-semibold">Status Text</th>
                <th className="px-4 py-3.5 font-semibold">Battery Status</th>
                <th className="px-4 py-3.5 font-semibold">Wiring Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr
                  key={v.regNo + i}
                  className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-4 py-3 font-semibold text-black">
                    {v.regNo}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{v.region}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {v.reportingDateTime?.replace('T', ' ')}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-3 text-neutral-500"
                    title={v.location}
                  >
                    {v.location}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={v.reportingStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={v.statusText} />
                  </td>
                  <td className="px-4 py-3">
                    <BatteryValue value={v.batteryStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={v.wirringStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
