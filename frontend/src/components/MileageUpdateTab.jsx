import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { buildTablePdf } from '../reportPdf'
import { api } from '../api'
import { vehicleTypeOf } from '../vehicleTypes'
import { driverOf } from '../drivers'
import { usedForOf } from '../usedFor'
import { supervisorOf } from '../supervisors'
import { findThreshold } from '../thresholds'
import { dayRange } from '../reportRange'

const COLUMNS = [
  { key: 'sr', label: 'Sr', align: 'text-center' },
  { key: 'vehicleCode', label: 'Vehicle Code', align: 'text-left' },
  { key: 'vehType', label: 'Veh Type', align: 'text-left' },
  { key: 'driverName', label: 'Driver Name', align: 'text-left' },
  { key: 'usedFor', label: 'Used For', align: 'text-left' },
  { key: 'supervisor', label: 'Supervisor', align: 'text-left' },
  { key: 'mileage', label: 'Mileage', align: 'text-right' },
  { key: 'workingHours', label: 'Working Hours', align: 'text-right' },
  { key: 'status', label: 'Status', align: 'text-center' },
  { key: 'lastUpdated', label: 'Last Updated', align: 'text-left' },
]

const NUMERIC_KEYS = new Set(['mileage', 'workingHours'])

const GROUP_START_KEYS = new Set(['vehicleCode', 'driverName', 'mileage'])

const DATA_COLUMNS = COLUMNS.slice(2)

const COLUMN_WIDTHS = [
  '5%',
  '11%',
  '12%',
  '13%',
  '11%',
  '11%',
  '8%',
  '10%',
  '7%',
  '12%',
]

const PDF_ALIGN = {
  'text-center': 'center',
  'text-right': 'right',
  'text-left': 'left',
}

const PDF_MUTED = [156, 163, 175]

const primaryBtnClass =
  'btn-shine relative overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

const outlineBtnClass =
  'rounded-full border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition-all duration-200 hover:border-green-600 hover:bg-green-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white'
const PDF_LOW_TEXT = [120, 53, 15]
const PDF_ZEBRA = [240, 253, 244]

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDay(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatStamp(date) {
  return `${formatDay(date)}, ${formatTime(date)}`
}

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function parseNumber(value) {
  const n = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseDuration(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parts = text.split(':').map((part) => parseFloat(part))
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
  return parts[0] * 3600
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function mergeMileage(values) {
  if (values.length === 1) return values[0] ?? ''
  const numbers = values.map(parseNumber).filter((n) => n !== null)
  if (numbers.length === 0) return ''
  const total = numbers.reduce((sum, n) => sum + n, 0)
  return String(Math.round(total * 10) / 10)
}

function mergeHours(values) {
  if (values.length === 1) return values[0] ?? ''
  const durations = values.map(parseDuration)
  if (durations.every((d) => d === null)) return ''
  const total = durations.reduce((sum, d) => sum + (d ?? 0), 0)
  return formatDuration(total)
}

function formatMileage(value) {
  const n = parseNumber(value)
  return n === null ? '' : n.toFixed(2)
}

function computeStatus(code, reportMap) {
  const threshold = findThreshold(displayValue(code, 'vehType', reportMap))
  if (!threshold) return ''
  const mileage = parseNumber(displayValue(code, 'mileage', reportMap))
  const hours = parseDuration(displayValue(code, 'workingHours', reportMap))
  const requiredHours = parseDuration(threshold.workingHours)
  if (mileage === null || hours === null) return ''
  const mileageOk = mileage >= threshold.mileage
  const hoursOk = requiredHours === null || hours >= requiredHours
  return mileageOk && hoursOk ? 'Ok' : 'Low'
}

function displayValue(code, field, reportMap) {
  if (field === 'status') return computeStatus(code, reportMap)
  if (field === 'lastUpdated') {
    const fetched = reportMap[normalizeKey(code)]?.lastUpdated
    return fetched === undefined || fetched === null
      ? ''
      : String(fetched).replace('T', ' ')
  }
  if (field === 'vehType') return vehicleTypeOf(code)
  if (field === 'driverName') return driverOf(code)
  if (field === 'usedFor') return usedForOf(code)
  if (field === 'supervisor') return supervisorOf(code)
  if (field === 'mileage') {
    const fetched = reportMap[normalizeKey(code)]?.mileage
    return fetched === undefined || fetched === null ? '' : formatMileage(fetched)
  }
  if (field === 'workingHours') {
    const fetched = reportMap[normalizeKey(code)]?.workingHours
    return fetched === undefined || fetched === null ? '' : String(fetched)
  }
  return ''
}

const STATUS_BADGE_STYLES = {
  Ok: 'bg-brand-600 text-white border border-brand-600',
  Low: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
}

const STATUS_DOT_STYLES = {
  Ok: 'bg-white',
  Low: 'bg-amber-500',
}

function StatusCell({ value }) {
  if (!value) return <span className="text-neutral-300">—</span>
  const style = STATUS_BADGE_STYLES[value]
  if (!style) {
    return (
      <span className="inline-block rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap text-neutral-600">
        {value}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_STYLES[value]}`} />
      {value}
    </span>
  )
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

function cellClass(column, isLow = false) {
  const divider = GROUP_START_KEYS.has(column.key)
    ? `border-l ${isLow ? 'border-amber-300' : 'border-neutral-400'}`
    : ''
  if (column.key === 'sr')
    return 'px-3 py-2.5 text-center align-middle text-xs tabular-nums text-neutral-400'
  if (column.key === 'vehicleCode')
    return `px-3 py-2.5 align-middle font-semibold ${divider}`
  if (NUMERIC_KEYS.has(column.key))
    return `px-3 py-2.5 text-right align-middle font-medium tabular-nums ${
      isLow ? 'text-amber-900' : 'text-ink'
    } ${divider}`
  if (column.key === 'status') return 'px-3 py-2.5 text-center align-middle'
  if (column.key === 'lastUpdated')
    return 'px-3 py-2.5 align-middle text-xs tabular-nums whitespace-nowrap text-neutral-500'
  return `px-3 py-2.5 align-middle break-words ${
    isLow ? 'text-amber-900' : 'text-neutral-700'
  } ${divider}`
}

function codeOf(vehicle) {
  return String(vehicle.alias || vehicle.unitID).trim()
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Ok', label: 'Ok' },
  { key: 'Low', label: 'Low' },
]

async function copyNodeAsImage(node, filename) {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  })
  const blob = await (await fetch(dataUrl)).blob()
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ])
    return 'Image copied to clipboard'
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return 'Clipboard unavailable — image downloaded'
}

export default function MileageUpdateTab({ token }) {
  const [vehicles, setVehicles] = useState([])
  const [reportMap, setReportMap] = useState({})
  const [generatedAt, setGeneratedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [codeSort, setCodeSort] = useState('asc')
  const tableRef = useRef(null)
  const [exporting, setExporting] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const runIdRef = useRef(0)

  async function copyAsImage() {
    const node = tableRef.current
    if (!node || exporting) return
    setExporting('copy')
    setExportMessage('')
    try {
      const message = await copyNodeAsImage(
        node,
        `mileage-update-${formatDate(new Date())}.png`,
      )
      setExportMessage(message)
    } catch (err) {
      setExportMessage(err?.message || 'Could not copy image')
    } finally {
      setExporting('')
    }
  }

  function downloadPdf() {
    if (exporting || sortedVehicles.length === 0) return
    setExporting('pdf')
    setExportMessage('')
    try {
      const columns = COLUMNS.map((col, i) => ({
        label: col.label,
        align: PDF_ALIGN[col.align] ?? 'left',
        width: parseFloat(COLUMN_WIDTHS[i]) || 10,
      }))
      let okCount = 0
      let lowCount = 0
      const pdfRows = sortedVehicles.map((vehicle, index) => {
        const code = codeOf(vehicle)
        const status = displayValue(code, 'status', reportMap)
        const isLow = status === 'Low'
        if (status === 'Ok') okCount += 1
        if (isLow) lowCount += 1
        return {
          bg: index % 2 === 0 ? PDF_ZEBRA : [255, 255, 255],
          cells: COLUMNS.map((col) => {
            if (col.key === 'sr') {
              return { text: index + 1, align: 'center', color: PDF_MUTED }
            }
            if (col.key === 'status') {
              if (status === 'Ok') {
                return {
                  badge: { text: 'Ok', bg: [234, 88, 12], color: [255, 255, 255] },
                }
              }
              if (isLow) {
                return {
                  badge: { text: 'Low', bg: [254, 243, 199], color: PDF_LOW_TEXT },
                }
              }
              return { text: '—', align: 'center', color: PDF_MUTED }
            }
            const value =
              col.key === 'vehicleCode'
                ? code
                : displayValue(code, col.key, reportMap)
            if (!value) return { text: '—', color: PDF_MUTED }
            return {
              text: value,
              bold: col.key === 'vehicleCode',
              color: isLow ? PDF_LOW_TEXT : undefined,
            }
          }),
        }
      })
      const footer = {
        cells: COLUMNS.map((col) => {
          if (col.key === 'sr') return { text: 'Σ', align: 'center' }
          if (col.key === 'vehicleCode') return { text: `Total (${totals.count})` }
          if (col.key === 'mileage') return { text: totals.mileage.toFixed(2) }
          if (col.key === 'workingHours') return { text: formatDuration(totals.hours) }
          if (col.key === 'status') {
            return { text: `${okCount} Ok / ${lowCount} Low`, align: 'center' }
          }
          return { text: '—', color: PDF_MUTED }
        }),
      }
      buildTablePdf({
        filename: `mileage-update-${formatDate(new Date())}.pdf`,
        title: 'Mileage Update Report',
        subtitle: `Daily mileage, working hours and assignment status · ${formatDay(stamp)} · Generated ${formatTime(stamp)} · Vehicles ${sortedVehicles.length} · Ok ${statusCounts.Ok} / Low ${statusCounts.Low}`,
        note: 'Ok — meets mileage and working-hour threshold · Low — below threshold · Source: TrackingWorld',
        accent: [21, 128, 61],
        zebra: PDF_ZEBRA,
        columns,
        rows: pdfRows,
        footer,
      })
      setExportMessage('PDF downloaded')
    } catch (err) {
      setExportMessage(err?.message || 'Could not download PDF')
    } finally {
      setExporting('')
    }
  }

  function statusOf(vehicle) {
    return displayValue(codeOf(vehicle), 'status', reportMap)
  }

  const statusCounts = { all: vehicles.length, Ok: 0, Low: 0 }
  for (const vehicle of vehicles) {
    const value = statusOf(vehicle)
    if (statusCounts[value] !== undefined) statusCounts[value] += 1
  }
  const visibleVehicles =
    statusFilter === 'all'
      ? vehicles
      : vehicles.filter((vehicle) => statusOf(vehicle) === statusFilter)

  const sortedVehicles =
    codeSort === 'none'
      ? visibleVehicles
      : [...visibleVehicles].sort((a, b) => {
          const result = codeOf(a).localeCompare(codeOf(b), undefined, {
            numeric: true,
            sensitivity: 'base',
          })
          return codeSort === 'asc' ? result : -result
        })

  function toggleCodeSort() {
    setCodeSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const stamp = generatedAt ?? new Date()

  const totals = sortedVehicles.reduce(
    (acc, vehicle) => {
      const code = codeOf(vehicle)
      const mileage = parseNumber(displayValue(code, 'mileage', reportMap))
      const hours = parseDuration(displayValue(code, 'workingHours', reportMap))
      if (mileage !== null) acc.mileage += mileage
      if (hours !== null) acc.hours += hours
      if (statusOf(vehicle) === 'Ok') acc.ok += 1
      if (statusOf(vehicle) === 'Low') acc.low += 1
      acc.count += 1
      return acc
    },
    { mileage: 0, hours: 0, ok: 0, low: 0, count: 0 },
  )

  async function loadMileage(initial = false) {
    const runId = ++runIdRef.current
    const isCurrent = () => runIdRef.current === runId
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const data = await api('/vehicle/getlist', { token })
      const list = data?.data ?? []
      if (!isCurrent()) return
      setVehicles(list)
      if (list.length > 0) {
        const range = dayRange(new Date())
        const map = {}
        try {
          const report = await api('/report/distance/preview', {
            token,
            body: {
              UnitIDs: list.map((u) => u.unitID),
              ...range,
            },
          })
          if (!isCurrent()) return
          const grouped = new Map()
          for (const row of report?.summary ?? []) {
            const key = normalizeKey(row.vehicleRegNumber)
            if (!key) continue
            if (!grouped.has(key)) grouped.set(key, [])
            grouped.get(key).push(row)
          }
          for (const [key, rows] of grouped) {
            map[key] = {
              mileage: mergeMileage(rows.map((row) => row.mileage)),
              workingHours: mergeHours(rows.map((row) => row.igONTime)),
            }
          }
        } catch (err) {
          if (isCurrent()) setError(err.message)
        }
        try {
          const status = await api('/vehicle/getstatus', { token })
          if (!isCurrent()) return
          for (const v of status?.vehicles ?? []) {
            const key = normalizeKey(v.regNo)
            if (!key) continue
            map[key] = { ...map[key], lastUpdated: v.reportingDateTime }
          }
        } catch (err) {
          if (isCurrent()) setError(err.message)
        }
        if (!isCurrent()) return
        setReportMap(map)
        setGeneratedAt(new Date())
      }
    } catch (err) {
      if (isCurrent()) setError(err.message)
    } finally {
      if (isCurrent()) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    loadMileage(true)
    return () => {
      runIdRef.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-7 w-1.5 rounded-full bg-green-700" />
          <div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Mileage Update
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Daily mileage, working hours and vehicle assignment records
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {exportMessage && (
            <span className="text-xs font-medium text-green-700">
              {exportMessage}
            </span>
          )}
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-green-200 bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-green-600 focus:border-green-600 focus:outline-none"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.key} value={filter.key}>
                  {filter.label} ({statusCounts[filter.key] ?? 0})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => loadMileage(false)}
            disabled={refreshing || loading || Boolean(exporting)}
            className={outlineBtnClass}
          >
            {refreshing ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                Refreshing…
              </span>
            ) : (
              'Refresh Mileage'
            )}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={Boolean(exporting) || visibleVehicles.length === 0}
            className={primaryBtnClass}
          >
            {exporting === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={copyAsImage}
            disabled={Boolean(exporting) || visibleVehicles.length === 0}
            className={outlineBtnClass}
          >
            {exporting === 'copy' ? 'Copying…' : 'Copy as Image'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 border-l-4 border-green-700 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
          Loading vehicles...
        </div>
      )}

      {!loading && vehicles.length === 0 && !error && (
        <p className="text-sm text-neutral-500">No vehicles found.</p>
      )}

      {!loading &&
        vehicles.length > 0 &&
        visibleVehicles.length === 0 && (
          <p className="text-sm text-neutral-500">
            No vehicles with status {statusFilter}.
          </p>
        )}

      {visibleVehicles.length > 0 && (
        <div
          ref={tableRef}
          className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm"
        >
          <div className="h-1.5 w-full bg-green-700" />
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-6 py-5">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-700 text-sm font-bold text-white">
                VA
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                  Vehicle Automation
                </p>
                <h3 className="text-lg font-bold tracking-tight text-ink">
                  Mileage Update Report
                </h3>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Daily mileage, working hours and assignment status per vehicle
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5 sm:grid-cols-4">
              <Meta label="Report Date" value={formatDay(stamp)} />
              <Meta label="Generated" value={formatTime(stamp)} />
              <Meta label="Vehicles" value={sortedVehicles.length} />
              <Meta
                label="Ok / Low"
                value={`${statusCounts.Ok} / ${statusCounts.Low}`}
              />
            </dl>
          </div>

          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                {COLUMN_WIDTHS.map((width) => (
                  <col key={width} style={{ width }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                  <th className="px-3 py-2" />
                  <th
                    colSpan={2}
                    className="border-l border-white/25 px-3 py-2 text-center font-semibold"
                  >
                    Vehicle
                  </th>
                  <th
                    colSpan={3}
                    className="border-l border-white/25 px-3 py-2 text-center font-semibold"
                  >
                    Assignment
                  </th>
                  <th
                    colSpan={4}
                    className="border-l border-white/25 px-3 py-2 text-center font-semibold"
                  >
                    Today&apos;s Performance
                  </th>
                </tr>
                <tr className="border-b-2 border-green-700 bg-green-100 text-[10px] tracking-wider text-green-900 uppercase">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      className={`px-3 py-2.5 align-middle font-semibold ${
                        GROUP_START_KEYS.has(column.key)
                          ? 'border-l border-neutral-400'
                          : ''
                      } ${column.align}`}
                    >
                      {column.key === 'vehicleCode' ? (
                        <button
                          type="button"
                          onClick={toggleCodeSort}
                          title="Sort by vehicle code"
                          className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-green-900"
                        >
                          {column.label}
                          <span className="text-[9px]">
                            {codeSort === 'asc' ? '▲' : '▼'}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedVehicles.map((vehicle, index) => {
                  const code = codeOf(vehicle)
                  const status = displayValue(code, 'status', reportMap)
                  const isLow = status === 'Low'
                  return (
                    <tr
                      key={vehicle.unitID}
                      className={`border-b border-neutral-400 transition-colors last:border-b-0 ${
                        index % 2 === 0
                          ? 'bg-green-50 hover:bg-green-100'
                          : 'bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <td
                        className={`px-3 py-2.5 text-center align-middle text-xs tabular-nums border-l-4 ${
                          isLow
                            ? 'border-l-amber-500 font-semibold text-amber-900'
                            : 'border-l-transparent text-neutral-400'
                        }`}
                      >
                        {index + 1}
                      </td>
                      <td
                        className={`px-3 py-2.5 align-middle font-semibold ${
                          isLow ? 'text-amber-900' : 'text-ink'
                        }`}
                      >
                        {code}
                      </td>
                      {DATA_COLUMNS.map((column) => {
                        const value =
                          column.key === 'status'
                            ? status
                            : displayValue(code, column.key, reportMap)
                        return (
                          <td
                            key={column.key}
                            className={cellClass(column, isLow)}
                          >
                            {column.key === 'status' ? (
                              <StatusCell value={value} />
                            ) : value ? (
                              value
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-green-700 bg-green-50 text-[11px] font-semibold text-green-900">
                  <td className="px-3 py-3 text-center text-neutral-300">Σ</td>
                  <td className="px-3 py-3 tracking-wider whitespace-nowrap uppercase">
                    Total ({totals.count})
                  </td>
                  <td className="border-l border-neutral-400 px-3 py-3 text-neutral-400">
                    —
                  </td>
                  <td className="px-3 py-3 text-neutral-400">—</td>
                  <td className="px-3 py-3 text-neutral-400">—</td>
                  <td className="px-3 py-3 text-neutral-400">—</td>
                  <td className="border-l border-neutral-400 px-3 py-3 text-right tabular-nums">
                    {totals.mileage.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatDuration(totals.hours)}
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] tracking-wider whitespace-nowrap uppercase">
                    <span className="text-green-800">{totals.ok} Ok</span>
                    <span className="text-neutral-300"> / </span>
                    <span className="text-amber-700">{totals.low} Low</span>
                  </td>
                  <td className="px-3 py-3 text-neutral-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-6 py-3.5">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-600" />
                Ok — meets mileage and working-hour threshold
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Low — below threshold
              </span>
            </div>
            <p className="text-[11px] text-green-800">
              Source: TrackingWorld · Generated {formatStamp(stamp)}
            </p>
          </div>
          <div className="h-1 w-full bg-green-700" />
        </div>
      )}
    </div>
  )
}
