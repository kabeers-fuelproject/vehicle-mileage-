import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TODAY = new Date()

export default function DistanceReportTab({ token }) {
  const [fromDate, setFromDate] = useState(formatDate(TODAY))
  const [toDate, setToDate] = useState(formatDate(TODAY))
  const [units, setUnits] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [unitsError, setUnitsError] = useState('')
  const [loadingUnits, setLoadingUnits] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [rows, setRows] = useState(null)

  async function runReport(from, to, unitIds) {
    setError('')
    setRows(null)
    if (unitIds.length === 0) {
      setError('Select at least one vehicle.')
      return
    }
    setGenerating(true)
    try {
      const data = await api('/report/distance/preview', {
        token,
        body: {
          UnitIDs: unitIds,
          FromDate: `${from}T00:00:00`,
          ToDate: `${to}T23:59:59`,
        },
      })
      setRows(data.summary ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadUnits() {
      try {
        const data = await api('/vehicle/getlist', { token })
        if (cancelled) return
        const list = data?.data ?? []
        setUnits(list)
        setSelected(new Set(list.map((u) => u.unitID)))
        if (list.length > 0) {
          const today = formatDate(new Date())
          await runReport(today, today, list.map((u) => u.unitID))
        }
      } catch (err) {
        if (!cancelled) setUnitsError(err.message)
      } finally {
        if (!cancelled) setLoadingUnits(false)
      }
    }
    loadUnits()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return units
    return units.filter((u) => u.alias?.toLowerCase().includes(q))
  }, [units, search])

  const filteredRows = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.vehicleRegNumber?.toLowerCase().includes(q))
  }, [rows, search])

  function toggle(unitId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(unitId)) next.delete(unitId)
      else next.add(unitId)
      return next
    })
  }

  function toggleAll() {
    const visibleIds = filteredUnits.map((u) => u.unitID)
    const allVisibleSelected = visibleIds.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  async function generate(e) {
    e.preventDefault()
    await runReport(fromDate, toDate, [...selected])
  }

  const allVisibleSelected =
    filteredUnits.length > 0 &&
    filteredUnits.every((u) => selected.has(u.unitID))

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">Distance Report</h2>

      <form
        onSubmit={generate}
        className="mt-4 rounded-xl bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <button
            type="submit"
            disabled={generating || loadingUnits}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
          <span className="text-sm text-slate-500">
            {selected.size} of {units.length} vehicles selected
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search vehicle codes..."
              className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {search.trim() && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  disabled={filteredUnits.length === 0}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Select all visible
              </label>
            )}
          </div>

          {loadingUnits && (
            <p className="mt-3 text-sm text-slate-500">Loading vehicles...</p>
          )}
          {unitsError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {unitsError}
            </p>
          )}

          {!loadingUnits && !unitsError && !search.trim() && (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
              Type a vehicle code (e.g. HND-AR002) to search and select
              vehicles. All vehicles are included until you change the
              selection.
            </p>
          )}

          {!loadingUnits && !unitsError && search.trim() && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {filteredUnits.length === 0 && (
                <p className="px-2 py-1 text-sm text-slate-500">
                  No vehicles match "{search}"
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                {filteredUnits.map((u) => (
                  <label
                    key={u.unitID}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(u.unitID)}
                      onChange={() => toggle(u.unitID)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {u.alias || u.unitID}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {generating && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-white p-5 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm text-slate-500">
            Loading distance report...
          </span>
        </div>
      )}

      {filteredRows && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Report results</h3>
            <span className="text-sm text-slate-500">
              {search.trim()
                ? `${filteredRows.length} of ${rows.length} vehicles (filtered)`
                : `${rows.length} vehicles`}
            </span>
          </div>

          {filteredRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              {rows.length === 0
                ? 'No data for the selected vehicles and date range.'
                : `No report rows match "${search.trim()}".`}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">S #</th>
                    <th className="px-4 py-3 font-medium">Vehicle Reg Number</th>
                    <th className="px-4 py-3 font-medium">Vehicle type</th>
                    <th className="px-4 py-3 font-medium">Town</th>
                    <th className="px-4 py-3 font-medium">Mileage</th>
                    <th className="px-4 py-3 font-medium">IG Time</th>
                    <th className="px-4 py-3 font-medium">Fuel Allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.s_No}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5 text-slate-500">{row.s_No}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {row.vehicleRegNumber}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.vehType}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.town}</td>
                      <td className="px-4 py-2.5 text-slate-700">{row.mileage}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.igONTime}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {row.fuelAllocated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
