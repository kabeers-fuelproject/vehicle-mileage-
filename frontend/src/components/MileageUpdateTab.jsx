import { useEffect, useState } from 'react'
import { api } from '../api'
import { vehicleTypeOf } from '../vehicleTypes'
import { driverOf } from '../drivers'
import { usedForOf } from '../usedFor'
import { supervisorOf } from '../supervisors'
import { findThreshold } from '../thresholds'

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

const STORAGE_KEY = 'mileageRecords'

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
    const normalized = {}
    for (const [key, value] of Object.entries(raw)) {
      normalized[key.trim()] = value
    }
    return normalized
  } catch {
    return {}
  }
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

function computeStatus(record, code, reportMap) {
  const threshold = findThreshold(
    displayValue(record, code, 'vehType', reportMap),
  )
  if (!threshold) return ''
  const mileage = parseNumber(displayValue(record, code, 'mileage', reportMap))
  const hours = parseDuration(
    displayValue(record, code, 'workingHours', reportMap),
  )
  const requiredHours = parseDuration(threshold.workingHours)
  if (mileage === null || hours === null) return ''
  const mileageOk = mileage >= threshold.mileage
  const hoursOk = requiredHours === null || hours >= requiredHours
  return mileageOk && hoursOk ? 'Ok' : 'Low'
}

function displayValue(record, code, field, reportMap) {
  if (field === 'status') return computeStatus(record, code, reportMap)
  if (field === 'lastUpdated') {
    const fetched = reportMap[code]?.lastUpdated
    return fetched === undefined || fetched === null
      ? ''
      : String(fetched).replace('T', ' ')
  }
  const manual = record[field]
  if (manual?.trim()) return manual
  if (field === 'vehType') return vehicleTypeOf(code)
  if (field === 'driverName') return driverOf(code)
  if (field === 'usedFor') return usedForOf(code)
  if (field === 'supervisor') return supervisorOf(code)
  if (field === 'mileage' || field === 'workingHours') {
    const fetched = reportMap[code]?.[field]
    return fetched === undefined || fetched === null ? '' : String(fetched)
  }
  return manual ?? ''
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

export default function MileageUpdateTab({ token }) {
  const [vehicles, setVehicles] = useState([])
  const [records] = useState(loadRecords)
  const [reportMap, setReportMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api('/vehicle/getlist', { token })
        const list = data?.data ?? []
        if (cancelled) return
        setVehicles(list)
        if (list.length > 0) {
          const today = formatDate(new Date())
          const map = {}
          try {
            const report = await api('/report/distance/preview', {
              token,
              body: {
                UnitIDs: list.map((u) => u.unitID),
                FromDate: `${today}T00:00:00`,
                ToDate: `${today}T23:59:59`,
              },
            })
            if (cancelled) return
            for (const row of report?.summary ?? []) {
              const reg = String(row.vehicleRegNumber ?? '').trim()
              if (reg)
                map[reg] = { mileage: row.mileage, workingHours: row.igONTime }
            }
          } catch (err) {
            if (!cancelled) setError(err.message)
          }
          try {
            const status = await api('/vehicle/getstatus', { token })
            if (cancelled) return
            for (const v of status?.vehicles ?? []) {
              const reg = String(v.regNo ?? '').trim()
              if (!reg) continue
              map[reg] = { ...map[reg], lastUpdated: v.reportingDateTime }
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
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">Mileage Update</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Mileage, working hours and vehicle assignment records
        </p>
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

      {vehicles.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black text-[11px] uppercase tracking-wider text-white">
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-3.5 font-semibold whitespace-nowrap"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle, index) => {
                const code = String(vehicle.alias || vehicle.unitID).trim()
                const record = records[code] ?? {}
                return (
                  <tr
                    key={vehicle.unitID}
                    className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-3 py-2 text-neutral-400">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap text-black">
                      {code}
                    </td>
                    {DATA_COLUMNS.map((column) => {
                      const value = displayValue(
                        record,
                        code,
                        column.key,
                        reportMap,
                      )
                      return (
                        <td
                          key={column.key}
                          className="px-3 py-2 whitespace-nowrap"
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
