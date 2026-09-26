import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { dayRange } from '../reportRange'
import { buildTablePdf } from '../reportPdf'
import VaLogo from './VaLogo'

const PDF_COLUMNS = [
  { label: 'S #', align: 'center', width: 6 },
  { label: 'Vehicle Reg Number', align: 'left', width: 18 },
  { label: 'Vehicle type', align: 'left', width: 15 },
  { label: 'Town', align: 'left', width: 15 },
  { label: 'Mileage', align: 'right', width: 10 },
  { label: 'IG Time', align: 'left', width: 16 },
  { label: 'Fuel Allocated', align: 'right', width: 14 },
]

const PDF_MUTED = [156, 163, 175]
const PDF_GREEN = [21, 128, 61]

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TODAY = new Date()

function formatDateTime(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${formatDate(date)} ${hh}:${mm}`
}

function Meta({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
        {value}
      </dd>
    </div>
  )
}

const inputClass =
  'mt-1.5 block rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none'

const labelClass =
  'text-[10px] font-semibold tracking-wider text-green-700 uppercase'

const primaryBtnClass =
  'btn-shine relative overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

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
  const [downloading, setDownloading] = useState(false)
  const [rows, setRows] = useState(null)
  const [stamp, setStamp] = useState(null)

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
      setStamp(new Date())
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

  async function downloadPdf() {
    if (downloading || !filteredRows || filteredRows.length === 0) return
    setDownloading(true)
    try {
      const pdfRows = filteredRows.map((row, index) => ({
        cells: [
          { text: row.s_No ?? index + 1, align: 'center', color: PDF_MUTED },
          { text: row.vehicleRegNumber, bold: true },
          { text: row.vehType },
          { text: row.town },
          { text: row.mileage, align: 'right' },
          { text: row.igONTime },
          { text: row.fuelAllocated, align: 'right' },
        ],
      }))
      buildTablePdf({
        filename: `distance-report-${fromDate}-to-${toDate}.pdf`,
        title: 'Distance Report',
        subtitle: `${filteredRows.length} vehicle${filteredRows.length === 1 ? '' : 's'} · ${fromDate} to ${toDate} · Generated ${formatDateTime(new Date())}`,
        accent: PDF_GREEN,
        columns: PDF_COLUMNS,
        rows: pdfRows,
      })
    } catch (err) {
      setError(err.message || 'Could not download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const allVisibleSelected =
    filteredUnits.length > 0 &&
    filteredUnits.every((u) => selected.has(u.unitID))

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
              Distance Report
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Distance and usage report for any date range
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
          <Meta label="Date Range" value={`${fromDate} → ${toDate}`} />
          <Meta
            label="Vehicles"
            value={`${selected.size} / ${units.length}`}
          />
        </dl>
      </div>

      <form
        onSubmit={generate}
        className="border-b border-neutral-200 px-6 py-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className={labelClass}>
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-neutral-500">
              {selected.size} of {units.length} vehicles selected
            </span>
            <button
              type="submit"
              disabled={generating || loadingUnits}
              className={primaryBtnClass}
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search vehicle codes..."
              className="w-72 rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
            />
            {search.trim() && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  disabled={filteredUnits.length === 0}
                  className="h-4 w-4 accent-green-700"
                />
                Select all visible
              </label>
            )}
          </div>

          {loadingUnits && (
            <div className="mt-3 flex items-center gap-2.5 text-sm text-neutral-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
              Loading vehicles...
            </div>
          )}
          {unitsError && (
            <p className="mt-3 border-l-4 border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              {unitsError}
            </p>
          )}

          {!loadingUnits && !unitsError && !search.trim() && (
            <p className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/60 px-4 py-6 text-center text-sm text-green-800/80">
              Type a vehicle code (e.g. HND-AR002) to search and select
              vehicles. All vehicles are included until you change the
              selection.
            </p>
          )}

          {!loadingUnits && !unitsError && search.trim() && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-green-200 p-2">
              {filteredUnits.length === 0 && (
                <p className="px-2 py-1 text-sm text-neutral-500">
                  No vehicles match "{search}"
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                {filteredUnits.map((u) => (
                  <label
                    key={u.unitID}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-green-100"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(u.unitID)}
                      onChange={() => toggle(u.unitID)}
                      className="h-4 w-4 accent-green-700"
                    />
                    {u.alias || u.unitID}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 border-l-4 border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            {error}
          </p>
        )}
      </form>

      <div className="px-6 py-5">
        {generating && (
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
            Loading distance report...
          </div>
        )}

        {filteredRows && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h4 className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                  Report Results
                </h4>
                <span className="text-sm text-neutral-500">
                  {search.trim()
                    ? `${filteredRows.length} of ${rows.length} vehicles (filtered)`
                    : `${rows.length} vehicles`}
                </span>
              </div>
              {filteredRows.length > 0 && (
                <button
                  type="button"
                  onClick={downloadPdf}
                  disabled={downloading}
                  className={`${primaryBtnClass} px-4 py-2`}
                >
                  {downloading ? 'Preparing…' : 'Download PDF'}
                </button>
              )}
            </div>

            {filteredRows.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">
                {rows.length === 0
                  ? 'No data for the selected vehicles and date range.'
                  : `No report rows match "${search.trim()}"`}
              </p>
            ) : (
              <div className="mt-4 -mx-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                      <th className="px-6 py-2.5 font-semibold">S #</th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        Vehicle Reg Number
                      </th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        Vehicle type
                      </th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        Town
                      </th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        Mileage
                      </th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        IG Time
                      </th>
                      <th className="border-l border-white/25 px-6 py-2.5 font-semibold">
                        Fuel Allocated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => (
                      <tr
                        key={row.s_No}
                        className={`border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-100 ${
                          i % 2 === 1 ? 'bg-green-50' : ''
                        }`}
                      >
                        <td className="px-6 py-3 text-neutral-400">
                          {row.s_No}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 font-semibold text-ink">
                          {row.vehicleRegNumber}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                          {row.vehType}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                          {row.town}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 text-ink">
                          {row.mileage}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                          {row.igONTime}
                        </td>
                        <td className="border-l border-neutral-300 px-6 py-3 text-neutral-600">
                          {row.fuelAllocated}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-700" />
            Mileage — distance covered in the selected range
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-400" />
            IG Time — ignition on · Fuel Allocated — fuel issued
          </span>
        </div>
        <p className="text-[11px] text-green-800">
          Source: TrackingWorld · Generated{' '}
          {stamp ? formatDateTime(stamp) : '—'}
        </p>
      </div>
      <div className="h-1 w-full bg-green-700" />
    </div>
  )
}
