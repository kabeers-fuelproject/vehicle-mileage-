import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useSelection } from '../SelectionContext'
import { usedForOf } from '../usedFor'
import { vehicleTypeOf } from '../vehicleTypes'
import { findThreshold } from '../thresholds'
import { dayRange } from '../reportRange'
import VaLogo from './VaLogo'
import LoadingOverlay from './LoadingOverlay'

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

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export default function SummaryTab({ token }) {
  const [distanceData, setDistanceData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const {
    rows,
    loading: selectionLoading,
    error: selectionError,
    refresh,
    flagAssigned,
    flagHired,
  } = useSelection()

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const unitsResult = await api('/vehicle/getlist', { token })
        if (cancelled) return

        // Fetch distance report for all vehicles to calculate thresholds
        const unitIds = (unitsResult?.data ?? []).map((u) => u.unitID)
        if (unitIds.length > 0) {
          const today = new Date()
          const range = dayRange(today)
          const distanceResult = await api('/report/distance/preview', {
            token,
            body: {
              UnitIDs: unitIds,
              ...range,
            },
          })
          if (!cancelled) {
            setDistanceData(distanceResult?.summary ?? [])
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

  const summaryData = useMemo(() => {
    const byUsedFor = new Map()

    // Aggregate distance rows per vehicle (a vehicle can appear multiple
    // times), summing mileage and ig-on hours like MileageUpdateTab does.
    const distanceMap = new Map()
    for (const d of distanceData) {
      const key = normalizeKey(d.vehicleRegNumber)
      if (!key) continue
      let entry = distanceMap.get(key)
      if (!entry) {
        entry = {
          mileage: 0,
          seconds: 0,
          hasMileage: false,
          hasHours: false,
          vehType: d.vehType ?? null,
        }
        distanceMap.set(key, entry)
      }
      const m = parseNumber(d.mileage)
      if (m !== null) {
        entry.mileage += m
        entry.hasMileage = true
      }
      const s = parseDuration(d.igONTime)
      if (s !== null) {
        entry.seconds += s
        entry.hasHours = true
      }
      if (!entry.vehType && d.vehType) entry.vehType = d.vehType
    }

    const groupFor = (code) => {
      const usedFor = usedForOf(code) || 'Uncategorized'
      let group = byUsedFor.get(usedFor)
      if (!group) {
        group = { usedFor, total: 0, hired: 0, thresholdMet: 0 }
        byUsedFor.set(usedFor, group)
      }
      return group
    }

    // A vehicle meets its threshold only when BOTH the daily mileage
    // allowance AND the required working hours are covered — same rules
    // as the Ok/Low status in MileageUpdateTab (local vehType mapping,
    // report data only for mileage/hours).
    const hasMetThreshold = (code) => {
      const entry = distanceMap.get(normalizeKey(code))
      const threshold = findThreshold(vehicleTypeOf(code) || entry?.vehType)
      if (!threshold) return false
      if (!entry || !entry.hasMileage || !entry.hasHours) return false

      const requiredHours = parseDuration(threshold.workingHours)
      const mileageOk = entry.mileage >= threshold.mileage
      const hoursOk = requiredHours === null || entry.seconds >= requiredHours
      return mileageOk && hoursOk
    }

    // Total (the 100% baseline) = assigned vehicles; Hired = hired
    // vehicles (can exceed Total); Threshold Met counts every working
    // vehicle — assigned or hired — that completed its threshold, so the
    // Threshold % can go above 100%.
    for (const r of rows) {
      const code = String(r.vehicle_code ?? '').trim()
      if (!code) continue
      const isAssigned = flagAssigned(r)
      const isHired = flagHired(r)
      if (!isAssigned && !isHired) continue

      const group = groupFor(code)
      if (isAssigned) group.total++
      if (isHired) group.hired++
      if (hasMetThreshold(code)) group.thresholdMet++
    }

    return Array.from(byUsedFor.values())
      .map((g) => ({
        usedFor: g.usedFor,
        totalMachinery: g.total,
        hired: g.hired,
        thresholdMet: g.thresholdMet,
        percentage:
          g.total > 0
            ? Math.round((g.thresholdMet / g.total) * 100)
            : 0,
      }))
      .sort((a, b) => a.usedFor.localeCompare(b.usedFor))
  }, [rows, distanceData, flagAssigned, flagHired])

  const totals = useMemo(() => ({
    totalMachinery: summaryData.reduce((sum, g) => sum + g.totalMachinery, 0),
    hired: summaryData.reduce((sum, g) => sum + g.hired, 0),
    thresholdMet: summaryData.reduce((sum, g) => sum + g.thresholdMet, 0),
  }), [summaryData])

  const overallPercentage = totals.totalMachinery > 0
    ? Math.round((totals.hired / totals.totalMachinery) * 100)
    : 0

  const overallThresholdPercentage = totals.totalMachinery > 0
    ? Math.round((totals.thresholdMet / totals.totalMachinery) * 100)
    : 0

  const isLoading = loading || selectionLoading
  const loadError = error || selectionError

  return (
    <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      {isLoading && (
        <LoadingOverlay label="Loading summary..." />
      )}
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <VaLogo className="h-11 w-11" />
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Automation
            </p>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Summary
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Assigned and hired vehicles grouped by purpose
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-5 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
          <Meta label="Total Machinery" value={totals.totalMachinery} />
          <Meta label="Total Hired" value={totals.hired} />
          <Meta label="Threshold Met" value={totals.thresholdMet} />
          <Meta label="Hired %" value={`${overallPercentage}%`} />
          <Meta label="Threshold %" value={`${overallThresholdPercentage}%`} />
        </dl>
      </div>

      {loadError && (
        <p className="mx-6 mt-5 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {loadError}
        </p>
      )}

      {!isLoading && !loadError && (
        <div className="px-6 py-5">
          <div className="overflow-x-auto rounded-xl border border-green-200">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                  <th className="px-6 py-3 font-semibold">Total Machinery (Used For)</th>
                  <th className="border-l border-white/25 px-4 py-3 text-right font-semibold">
                    Total
                  </th>
                  <th className="border-l border-white/25 px-4 py-3 text-right font-semibold">
                    Hired
                  </th>
                  <th className="border-l border-white/25 px-4 py-3 text-right font-semibold">
                    Threshold
                  </th>
                  <th className="border-l border-white/25 px-4 py-3 text-right font-semibold">
                    Threshold %
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryData.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-neutral-500" colSpan={5}>
                      No data available
                    </td>
                  </tr>
                ) : (
                  summaryData.map((group, i) => (
                    <tr
                      key={group.usedFor}
                      className={`border-b border-neutral-100 transition-colors last:border-0 ${
                        group.thresholdMet < group.totalMachinery
                          ? 'anim-threshold-blink'
                          : 'hover:bg-green-50' +
                            (i % 2 === 1 ? ' bg-green-50/40' : '')
                      }`}
                    >
                      <td className="px-6 py-3 font-semibold text-ink">
                        {group.usedFor}
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800 font-semibold">
                        {group.totalMachinery}
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800 font-semibold">
                        {group.hired}
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800 font-semibold">
                        {group.thresholdMet}
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums">
                        <span className={`font-semibold ${
                          group.percentage >= 80 ? 'text-green-700' :
                          group.percentage >= 50 ? 'text-amber-700' : 'text-red-700'
                        }`}>
                          {group.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                <tr className="bg-green-50 border-t-2 border-green-200 font-semibold">
                  <td className="px-6 py-3 text-ink">Total</td>
                  <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800">
                    {totals.totalMachinery}
                  </td>
                  <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800">
                    {totals.hired}
                  </td>
                  <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800">
                    {totals.thresholdMet}
                  </td>
                  <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums">
                    <span className={`font-semibold ${
                      overallThresholdPercentage >= 80 ? 'text-green-700' :
                      overallThresholdPercentage >= 50 ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      {overallThresholdPercentage}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="h-1 w-full bg-green-700" />
    </div>
  )
}