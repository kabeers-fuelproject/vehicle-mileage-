import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'

function StatCard({ label, value, accent = 'text-slate-800' }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ value }) {
  const styles = {
    Reporting: 'bg-green-100 text-green-700',
    'Not Reporting': 'bg-red-100 text-red-700',
    Moving: 'bg-blue-100 text-blue-700',
    Idle: 'bg-yellow-100 text-yellow-700',
    'Excess Idling': 'bg-orange-100 text-orange-700',
    Parked: 'bg-slate-200 text-slate-700',
    'No Activity Since Yesterday': 'bg-purple-100 text-purple-700',
    Ok: 'bg-green-100 text-green-700',
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[value] || 'bg-slate-100 text-slate-600'}`}
    >
      {value ?? '—'}
    </span>
  )
}

function BatteryValue({ value }) {
  if (value === null || value === undefined || value === 0) {
    return <span className="text-slate-400">—</span>
  }
  const low = value < 11.5
  return (
    <span className={low ? 'font-medium text-red-600' : 'text-slate-700'}>
      {Number(value).toFixed(2)} V
    </span>
  )
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
        <h2 className="text-xl font-bold text-slate-800">Vehicle Status</h2>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {counts.totalCount !== undefined && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={counts.totalCount} />
          <StatCard
            label="Reporting"
            value={counts.reportingCount}
            accent="text-green-600"
          />
          <StatCard
            label="Not Reporting"
            value={counts.notReportingCount}
            accent="text-red-600"
          />
          <StatCard label="Moving" value={counts.movingCount} accent="text-blue-600" />
          <StatCard label="Parked" value={counts.parkedCount} />
          <StatCard
            label="Idling"
            value={counts.idlingCount}
            accent="text-orange-600"
          />
        </div>
      )}

      {loading && !data && (
        <p className="mt-6 text-slate-500">Loading vehicle status...</p>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <p className="mt-6 text-slate-500">No vehicles found.</p>
      )}

      {vehicles.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Vehicle Reg No.</th>
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Reporting Date/Time</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Reporting Status</th>
                <th className="px-4 py-3 font-medium">Status Text</th>
                <th className="px-4 py-3 font-medium">Battery Status</th>
                <th className="px-4 py-3 font-medium">Wiring Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr
                  key={v.regNo + i}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {v.regNo}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{v.region}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                    {v.reportingDateTime?.replace('T', ' ')}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-2.5 text-slate-600"
                    title={v.location}
                  >
                    {v.location}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={v.reportingStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={v.statusText} />
                  </td>
                  <td className="px-4 py-2.5">
                    <BatteryValue value={v.batteryStatus} />
                  </td>
                  <td className="px-4 py-2.5">
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
