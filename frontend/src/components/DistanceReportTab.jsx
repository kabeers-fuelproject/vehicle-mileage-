import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { dayRange } from '../reportRange'

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
          ...dayRange(from, to),
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
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">Distance Report</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Distance and usage report for any date range
        </p>
      </div>

      <form
        onSubmit={generate}
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
              className="mt-2 block rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
              className="mt-2 block rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </label>
          <button
            type="submit"
            disabled={generating || loadingUnits}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
          <span className="text-sm text-neutral-500">
            {selected.size} of {units.length} vehicles selected
          </span>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search vehicle codes..."
              className="w-72 rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
            {search.trim() && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  disabled={filteredUnits.length === 0}
                  className="h-4 w-4 accent-black"
                />
                Select all visible
              </label>
            )}
          </div>

          {loadingUnits && (
            <div className="mt-3 flex items-center gap-2.5 text-sm text-neutral-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              Loading vehicles...
            </div>
          )}
          {unitsError && (
            <p className="mt-3 border-l-4 border-brand-600 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
              {unitsError}
            </p>
          )}

          {!loadingUnits && !unitsError && !search.trim() && (
            <p className="mt-3 rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
              Type a vehicle code (e.g. HND-AR002) to search and select
              vehicles. All vehicles are included until you change the
              selection.
            </p>
          )}

          {!loadingUnits && !unitsError && search.trim() && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-neutral-200 p-2">
              {filteredUnits.length === 0 && (
                <p className="px-2 py-1 text-sm text-neutral-500">
                  No vehicles match "{search}"
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                {filteredUnits.map((u) => (
                  <label
                    key={u.unitID}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(u.unitID)}
                      onChange={() => toggle(u.unitID)}
                      className="h-4 w-4 accent-black"
                    />
                    {u.alias || u.unitID}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 border-l-4 border-brand-600 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
            {error}
          </p>
        )}
      </form>

      {generating && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <span className="text-sm text-neutral-500">
            Loading distance report...
          </span>
        </div>
      )}

      {filteredRows && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold tracking-tight">Report results</h3>
            <span className="text-sm text-neutral-500">
              {search.trim()
                ? `${filteredRows.length} of ${rows.length} vehicles (filtered)`
                : `${rows.length} vehicles`}
            </span>
          </div>

          {filteredRows.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">
              {rows.length === 0
                ? 'No data for the selected vehicles and date range.'
                : `No report rows match "${search.trim()}".`}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-brand-600 text-[11px] uppercase tracking-wider text-white">
                    <th className="px-4 py-3.5 font-semibold">S #</th>
                    <th className="px-4 py-3.5 font-semibold">
                      Vehicle Reg Number
                    </th>
                    <th className="px-4 py-3.5 font-semibold">Vehicle type</th>
                    <th className="px-4 py-3.5 font-semibold">Town</th>
                    <th className="px-4 py-3.5 font-semibold">Mileage</th>
                    <th className="px-4 py-3.5 font-semibold">IG Time</th>
                    <th className="px-4 py-3.5 font-semibold">
                      Fuel Allocated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.s_No}
                      className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3 text-neutral-400">
                        {row.s_No}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {row.vehicleRegNumber}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.vehType}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.town}
                      </td>
                      <td className="px-4 py-3 text-ink">{row.mileage}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.igONTime}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
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
