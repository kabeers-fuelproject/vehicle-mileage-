import { useEffect, useState } from 'react'
import { api } from '../api'
import { vehicleTypeOf } from '../vehicleTypes'
import { driverOf } from '../drivers'
import { usedForOf } from '../usedFor'
import { supervisorOf } from '../supervisors'

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

const EDITABLE_FIELDS = COLUMNS.slice(2).map((c) => c.key)

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

function displayValue(record, code, field, mileageMap) {
  const manual = record[field]
  if (manual?.trim()) return manual
  if (field === 'vehType') return vehicleTypeOf(code)
  if (field === 'driverName') return driverOf(code)
  if (field === 'usedFor') return usedForOf(code)
  if (field === 'supervisor') return supervisorOf(code)
  if (field === 'mileage') {
    const fetched = mileageMap[code]
    return fetched === undefined || fetched === null ? '' : String(fetched)
  }
  return manual ?? ''
}

export default function MileageUpdateTab({ token }) {
  const [vehicles, setVehicles] = useState([])
  const [records, setRecords] = useState(loadRecords)
  const [mileageMap, setMileageMap] = useState({})
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
            const map = {}
            for (const row of report?.summary ?? []) {
              const reg = String(row.vehicleRegNumber ?? '').trim()
              if (reg) map[reg] = row.mileage
            }
            setMileageMap(map)
          } catch (err) {
            if (!cancelled) setError(err.message)
          }
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

  function update(code, field, value) {
    setRecords((prev) => {
      const next = {
        ...prev,
        [code]: { ...prev[code], [field]: value },
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // storage unavailable or full — keep in-memory state
      }
      return next
    })
  }

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
                    {EDITABLE_FIELDS.map((field) => (
                      <td key={field} className="p-1">
                        <input
                          type="text"
                          value={displayValue(record, code, field, mileageMap)}
                          onChange={(e) => update(code, field, e.target.value)}
                          placeholder="—"
                          className="w-full min-w-24 rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-black transition-colors placeholder:text-neutral-300 hover:border-neutral-300 focus:border-black focus:outline-none focus:ring-1 focus:ring-black/15"
                        />
                      </td>
                    ))}
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
