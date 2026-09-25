import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { api } from '../api'
import { vehicleTypeOf } from '../vehicleTypes'
import { driverOf } from '../drivers'
import { usedForOf } from '../usedFor'
import { supervisorOf } from '../supervisors'
import { findThreshold } from '../thresholds'
import { dayRange } from '../reportRange'

const COLUMNS = [
  { key: 'sr', label: 'Sr' },
  { key: 'vehicleCode', label: 'Vehicle Code' },
  { key: 'vehType', label: 'Veh Type' },
  { key: 'driverName', label: 'Driver Name' },
  { key: 'usedFor', label: 'Used For' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'mileage', label: 'Mileage' },
  { key: 'workingHours', label: 'Working Hours' },
  { key: 'status', label: 'Status' },
  { key: 'lastUpdated', label: 'Last Updated Time' },
]

const DATA_COLUMNS = COLUMNS.slice(2)

const COLUMN_WIDTHS = [
  '6%',
  '11%',
  '13%',
  '13%',
  '11%',
  '11%',
  '8%',
  '11%',
  '7%',
  '9%',
]

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  if (field === 'mileage' || field === 'workingHours') {
    const fetched = reportMap[normalizeKey(code)]?.[field]
    return fetched === undefined || fetched === null ? '' : String(fetched)
  }
  return ''
}

const STATUS_BADGE_STYLES = {
  Ok: 'bg-black text-white border border-black',
  Low: 'bg-white text-black border-2 border-black font-semibold',
}

function StatusCell({ value }) {
  if (!value) return <span className="text-neutral-300">—</span>
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap ${
        STATUS_BADGE_STYLES[value] ??
        'bg-neutral-100 text-neutral-600 border border-neutral-200'
      }`}
    >
      {value}
    </span>
  )
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [codeSort, setCodeSort] = useState('asc')
  const tableRef = useRef(null)
  const [copying, setCopying] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  async function copyAsImage() {
    const node = tableRef.current
    if (!node || copying) return
    setCopying(true)
    setCopyMessage('')
    try {
      const message = await copyNodeAsImage(
        node,
        `mileage-update-${formatDate(new Date())}.png`,
      )
      setCopyMessage(message)
    } catch (err) {
      setCopyMessage(err?.message || 'Could not copy image')
    } finally {
      setCopying(false)
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api('/vehicle/getlist', { token })
        const list = data?.data ?? []
        if (cancelled) return
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
            if (cancelled) return
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
            if (!cancelled) setError(err.message)
          }
          try {
            const status = await api('/vehicle/getstatus', { token })
            if (cancelled) return
            for (const v of status?.vehicles ?? []) {
              const key = normalizeKey(v.regNo)
              if (!key) continue
              map[key] = { ...map[key], lastUpdated: v.reportingDateTime }
            }
          } catch (err) {
            if (!cancelled) setError(err.message)
          }
          setReportMap(map)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Mileage Update</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Mileage, working hours and vehicle assignment records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {copyMessage && (
            <span className="text-xs text-neutral-500">{copyMessage}</span>
          )}
          <button
            type="button"
            onClick={copyAsImage}
            disabled={copying || visibleVehicles.length === 0}
            className="rounded-lg border border-black px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black"
          >
            {copying ? 'Copying…' : 'Copy as Image'}
          </button>
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-black transition-colors hover:border-black focus:border-black focus:outline-none"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.key} value={filter.key}>
                  {filter.label} ({statusCounts[filter.key] ?? 0})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <p className="mb-4 border-l-4 border-black bg-neutral-100 px-4 py-3 text-sm font-medium text-black">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
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
          className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm"
        >
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              {COLUMN_WIDTHS.map((width) => (
                <col key={width} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-black text-[11px] uppercase tracking-wider text-white">
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-3.5 align-middle font-semibold"
                  >
                    {column.key === 'vehicleCode' ? (
                      <button
                        type="button"
                        onClick={toggleCodeSort}
                        title="Sort by vehicle code"
                        className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-white/70"
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
                return (
                  <tr
                    key={vehicle.unitID}
                    className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-3 py-2 align-middle text-neutral-400">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 align-middle font-semibold break-words text-black">
                      {code}
                    </td>
                    {DATA_COLUMNS.map((column) => {
                      const value = displayValue(code, column.key, reportMap)
                      return (
                        <td
                          key={column.key}
                          className="px-3 py-2 align-middle break-words"
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
          </table>
        </div>
      )}
    </div>
  )
}
