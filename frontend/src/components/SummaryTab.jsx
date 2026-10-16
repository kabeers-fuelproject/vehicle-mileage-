import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useSelection } from '../SelectionContext'
import { usedForOf } from '../usedFor'
import { driverOf } from '../drivers'
import { supervisorOf } from '../supervisors'
import { vehicleTypeOf } from '../vehicleTypes'
import { findThreshold } from '../thresholds'
import { dayRange } from '../reportRange'
import { buildTablePdf } from '../reportPdf'
import VaLogo from './VaLogo'
import LoadingOverlay from './LoadingOverlay'

const PDF_COLUMNS = [
  { label: 'Used For', align: 'left' },
  { label: 'Total', align: 'right', widthSample: '999' },
  { label: 'Hired', align: 'right', widthSample: '999' },
  { label: 'Threshold', align: 'right', widthSample: '999' },
  { label: 'Threshold %', align: 'right', widthSample: '100%' },
]

const GREEN = [21, 128, 61]
const AMBER = [180, 83, 9]
const RED = [185, 28, 28]

function percentColor(value) {
  if (value >= 80) return GREEN
  if (value >= 50) return AMBER
  return RED
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  const [openCategory, setOpenCategory] = useState('')
  const [downloading, setDownloading] = useState(false)
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

  // Aggregate distance rows per vehicle (a vehicle can appear multiple
  // times), summing mileage and ig-on hours like MileageUpdateTab does.
  const distanceMap = useMemo(() => {
    const map = new Map()
    for (const d of distanceData) {
      const key = normalizeKey(d.vehicleRegNumber)
      if (!key) continue
      let entry = map.get(key)
      if (!entry) {
        entry = {
          mileage: 0,
          seconds: 0,
          hasMileage: false,
          hasHours: false,
          vehType: d.vehType ?? null,
        }
        map.set(key, entry)
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
    return map
  }, [distanceData])

  // A vehicle meets its threshold only when BOTH the daily mileage
  // allowance AND the required working hours are covered — same rules
  // as the Ok/Low status in MileageUpdateTab (local vehType mapping,
  // report data only for mileage/hours).
  const hasMetThreshold = useCallback(
    (code) => {
      const entry = distanceMap.get(normalizeKey(code))
      const threshold = findThreshold(vehicleTypeOf(code) || entry?.vehType)
      if (!threshold) return false
      if (!entry || !entry.hasMileage || !entry.hasHours) return false

      const requiredHours = parseDuration(threshold.workingHours)
      const mileageOk = entry.mileage >= threshold.mileage
      const hoursOk = requiredHours === null || entry.seconds >= requiredHours
      return mileageOk && hoursOk
    },
    [distanceMap],
  )

  const summaryData = useMemo(() => {
    const byUsedFor = new Map()

    const groupFor = (code) => {
      const usedFor = usedForOf(code) || 'Uncategorized'
      let group = byUsedFor.get(usedFor)
      if (!group) {
        group = { usedFor, total: 0, hired: 0, thresholdMet: 0 }
        byUsedFor.set(usedFor, group)
      }
      return group
    }

    // Total (the 100% baseline) = assigned vehicles; Hired = hired
    // vehicles (can exceed Total); Threshold Met counts every working
    // vehicle — assigned or hired — that completed its threshold, so the
    // Threshold % can go above 100%. Hired % = hired / Total is also
    // uncapped — when hired exceeds the assigned count it shows >100%.
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
        hiredPercentage:
          g.total > 0 ? Math.round((g.hired / g.total) * 100) : null,
      }))
      .sort((a, b) => a.usedFor.localeCompare(b.usedFor))
  }, [rows, hasMetThreshold, flagAssigned, flagHired])

  // Assigned vehicles per category with details, shown in the popup
  // when a category name in the Used For column is clicked.
  const vehiclesByCategory = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const code = String(r.vehicle_code ?? '').trim()
      if (!code || !flagAssigned(r)) continue
      const usedFor = usedForOf(code) || 'Uncategorized'
      let list = map.get(usedFor)
      if (!list) {
        list = []
        map.set(usedFor, list)
      }
      list.push({
        code,
        driver: driverOf(code),
        supervisor: supervisorOf(code),
      })
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    }
    return map
  }, [rows, flagAssigned])

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

  const openVehicles = openCategory
    ? vehiclesByCategory.get(openCategory) ?? []
    : []

  function downloadPdf() {
    if (downloading || summaryData.length === 0) return
    setDownloading(true)
    try {
      const pdfRows = summaryData.map((group) => ({
        cells: [
          { text: group.usedFor, bold: true },
          { text: group.totalMachinery, align: 'right' },
          { text: group.hired, align: 'right' },
          { text: group.thresholdMet, align: 'right' },
          {
            text: `${group.percentage}%`,
            align: 'right',
            color: percentColor(group.percentage),
            bold: true,
          },
        ],
      }))
      buildTablePdf({
        filename: `summary-${formatDate(new Date())}.pdf`,
        title: 'Summary',
        subtitle: 'Assigned and hired vehicles grouped by purpose',
        columns: PDF_COLUMNS,
        rows: pdfRows,
        footer: {
          cells: [
            { text: 'Total' },
            { text: totals.totalMachinery, align: 'right' },
            { text: totals.hired, align: 'right' },
            { text: totals.thresholdMet, align: 'right' },
            {
              text: `${overallThresholdPercentage}%`,
              align: 'right',
              color: percentColor(overallThresholdPercentage),
            },
          ],
        },
        zebra: [240, 253, 244],
      })
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!openCategory) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenCategory('')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openCategory])

  const isLoading = loading || selectionLoading
  const loadError = error || selectionError

  return (
    <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      {(isLoading || downloading) && (
        <LoadingOverlay label={downloading ? 'Preparing PDF…' : 'Loading summary...'} />
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
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading || isLoading || summaryData.length === 0}
                aria-label="Download summary as PDF"
                className="group cursor-pointer rounded transition-colors hover:text-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="group-hover:hidden">Summary</span>
                <span className="hidden group-hover:inline">Download Summary</span>
              </button>
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
                    Hired %
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
                    <td className="px-6 py-8 text-center text-neutral-500" colSpan={6}>
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
                      <td className="px-6 py-3">
                        <button
                          type="button"
                          onClick={() => setOpenCategory(group.usedFor)}
                          title="View details of assigned vehicles in this category"
                          className="cursor-pointer rounded text-left font-semibold text-ink underline decoration-dotted decoration-neutral-300 underline-offset-4 transition-colors hover:text-green-700 hover:decoration-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40"
                        >
                          {group.usedFor}
                        </button>
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800 font-semibold">
                        {group.totalMachinery}
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums text-green-800 font-semibold">
                        {group.hired}
                      </td>
                      <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums">
                        <span className={`font-semibold ${
                          group.hiredPercentage === null ? 'text-neutral-400' :
                          group.hiredPercentage >= 80 ? 'text-green-700' :
                          group.hiredPercentage >= 50 ? 'text-amber-700' : 'text-red-700'
                        }`}>
                          {group.hiredPercentage === null ? '—' : `${group.hiredPercentage}%`}
                        </span>
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
                  <td className="border-l border-neutral-200 px-4 py-3 text-right tabular-nums">
                    <span className={`font-semibold ${
                      overallPercentage >= 80 ? 'text-green-700' :
                      overallPercentage >= 50 ? 'text-amber-700' : 'text-red-700'
                    }`}>
                      {overallPercentage}%
                    </span>
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

      {openCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpenCategory('')}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${openCategory} assigned vehicles`}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-xl"
          >
            <div className="h-1.5 w-full shrink-0 bg-green-700" />

            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                  Vehicle Automation
                </p>
                <h4 className="mt-0.5 text-base font-bold tracking-tight text-ink">
                  {openCategory}
                </h4>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Assigned vehicles in this category
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenCategory('')}
                aria-label="Close details"
                className="shrink-0 cursor-pointer rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-auto px-5 py-4">
              {openVehicles.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">
                  No assigned vehicles in this category.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                      <th className="px-3 py-2.5 font-semibold">Vehicle Code</th>
                      <th className="border-l border-white/25 px-3 py-2.5 font-semibold">
                        Driver
                      </th>
                      <th className="border-l border-white/25 px-3 py-2.5 font-semibold">
                        Supervisor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {openVehicles.map((vehicle, i) => (
                      <tr
                        key={vehicle.code}
                        className={`border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-50 ${
                          i % 2 === 1 ? 'bg-green-50/40' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-semibold text-ink">
                          {vehicle.code}
                        </td>
                        <td className="border-l border-neutral-200 px-3 py-2.5 text-neutral-700">
                          {vehicle.driver || '—'}
                        </td>
                        <td className="border-l border-neutral-200 px-3 py-2.5 text-neutral-700">
                          {vehicle.supervisor || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="h-1 w-full shrink-0 bg-green-700" />
          </div>
        </div>
      )}
    </div>
  )
}